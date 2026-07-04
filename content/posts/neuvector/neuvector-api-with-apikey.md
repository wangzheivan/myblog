---
title: "NeuVector REST API 实战：开启 API 并用 API Key 管理网络规则"
date: 2026-07-04
lastmod: 2026-07-04
description: "介绍如何在 Kubernetes 中暴露 NeuVector 的 REST API、如何创建并使用 API Key 认证，并以查询和清理网络规则的两个脚本为例演示 API 的实际调用。"
slug: "neuvector-api-with-apikey"
categories: ["NeuVector"]
tags: ["NeuVector", "REST API", "API Key", "Kubernetes", "容器安全", "网络规则"]
series: ""
draft: false
featured: false
cover: "/images/tech-cover.svg"
author: "Ivan"
---

NeuVector 的所有功能都可以通过 REST API 完成——从查询容器、扫描镜像，到管理网络策略、导出配置。当我们需要批量处理网络规则、把安全操作接入 CI/CD，或者做一些控制台里点起来很繁琐的重复动作时，直接调 API 往往是最高效的方式。

本文聚焦三件事：如何在 Kubernetes 中把 REST API 暴露出来、如何用 API Key 完成认证，以及通过两个实用脚本（列出网络规则、批量清理 learned 规则）演示 API 的真实调用。

## 一、开启（暴露）REST API

NeuVector 的 REST API 由 **Controller** 提供，监听端口为 `10443`（HTTPS）。在 Kubernetes 中，Controller 默认只在集群内部可达。如果要从集群外调用 API，需要单独为 Controller 暴露一个 Service。

官方推荐的做法是新建一个指向 `neuvector-controller-pod` 的 Service，开放 `10443` 端口。用 `LoadBalancer` 类型：

```yaml
apiVersion: v1
kind: Service
metadata:
  name: neuvector-svc-controller-api
  namespace: neuvector
spec:
  ports:
    - port: 10443
      name: controller-api
      protocol: TCP
  type: LoadBalancer
  selector:
    app: neuvector-controller-pod
```

如果集群没有 LoadBalancer，可以把 `type` 改成 `NodePort`，通过「节点 IP + 分配到的 NodePort」访问：

```yaml
apiVersion: v1
kind: Service
metadata:
  name: neuvector-svc-controller-api
  namespace: neuvector
spec:
  ports:
    - port: 10443
      name: controller-api
      protocol: TCP
  type: NodePort
  selector:
    app: neuvector-controller-pod
```

应用后确认 Service 的访问地址：

```bash
kubectl get svc -n neuvector neuvector-svc-controller-api
```

- `LoadBalancer`：使用 `EXTERNAL-IP` 加端口 `10443`，即 `https://<EXTERNAL-IP>:10443`。
- `NodePort`：使用任意节点 IP 加分配到的高位端口，例如 `https://<节点IP>:30443`。

> 说明：Controller 默认使用自签名证书，所以后面所有 `curl` 示例都带 `-k` 跳过证书校验。生产环境建议替换为受信任证书，并去掉 `-k`。多 Controller 部署时，涉及长任务状态轮询的请求应固定发往同一个 Controller IP。

## 二、创建并使用 API Key

REST API 支持两种认证方式：

| 认证方式 | 请求头 | 特点 |
| --- | --- | --- |
| 用户名/密码（Token） | `X-Auth-Token` | 先调用 `/v1/auth` 换取 token 再使用；每个用户并发会话数有限（最多 32），用完需 `DELETE /v1/auth` 释放 |
| API Key（Token-based） | `X-Auth-Apikey` | 直接在每个请求里携带，无并发会话限制；按创建时设定的有效期过期，适合脚本与自动化 |

对脚本和自动化场景，**API Key 更合适**：它不需要先登录换 token，也没有并发会话数的限制。

### 创建 API Key

在 NeuVector 控制台进入 **Settings → Users, API Keys & Roles**，新建一个 API Key：

- 为 Key 绑定一个角色（内置角色或自定义角色），按最小权限原则限制它能访问的范围；
- 设置有效期；
- 创建后立即复制 **Name** 和 **Secret**——弹窗关闭后 Secret 将无法再次查看。

API Key 在请求中的用法是把 `名称:密钥` 放进 `X-Auth-Apikey` 请求头。一个最小的调用示例——获取所有网络规则：

```bash
curl -k -sS \
  -H "X-Auth-Apikey: <你的APIKey名称>:<你的APIKey密钥>" \
  -H "Accept: application/json" \
  "https://<controller-ip>:10443/v1/policy/rule"
```

> 小提醒：API Key 的密钥里可能包含 `$`、`*`、`@`、`#` 等特殊字符。在 Shell 里赋值时务必用**单引号**包裹，否则 Bash 会把 `$xxx` 当变量解析，导致认证失败：
>
> ```bash
> X_AUTH_APIKEY='myapikey:cgmv3...*^dYBVy...@#Bfm...'
> ```

## 三、案例：网络规则的查询与清理

下面两个脚本演示 API Key 在真实场景中的用法：先只读地列出所有网络规则，再有选择地批量删除。两者都依赖 `curl` 和 `jq`（用于解析 JSON 返回），并用 `-w '\n%{http_code}'` 捕获 HTTP 状态码方便排错。涉及的接口：

- `GET /v1/policy/rule`：获取全部网络规则；
- `DELETE /v1/policy/rule/{id}`：按 ID 删除单条规则。

### 脚本一：列出所有网络规则 ID（只读）

第一步先做只读操作，把规则列出来、心里有数，脚本本身不做任何修改：

```bash
#!/usr/bin/env bash
set -euo pipefail

# Controller API 地址，格式示例：https://127.0.0.1:10443
CONTROLLER_API='https://<controller-ip>:10443'

# NeuVector API Key：名称:密钥。含特殊字符必须用单引号
X_AUTH_APIKEY='<你的APIKey名称>:<你的APIKey密钥>'

# 依赖检查：curl / jq
command -v curl >/dev/null 2>&1 || { echo "错误：未找到 curl"; exit 1; }
command -v jq   >/dev/null 2>&1 || { echo "错误：未找到 jq"; exit 1; }

echo "正在获取 NeuVector Network Rule：${CONTROLLER_API}/v1/policy/rule"

# -k 跳过自签证书校验；-w 附带 HTTP 状态码
RESPONSE="$(
  curl -k -sS \
    -w $'\n%{http_code}' \
    -H "X-Auth-Apikey: ${X_AUTH_APIKEY}" \
    -H "Accept: application/json" \
    "${CONTROLLER_API}/v1/policy/rule"
)"

HTTP_STATUS="${RESPONSE##*$'\n'}"
RESPONSE_BODY="${RESPONSE%$'\n'*}"
echo "HTTP 状态码：${HTTP_STATUS}"

# 非 2xx 视为失败，打印返回体
if [[ ! "${HTTP_STATUS}" =~ ^2[0-9][0-9]$ ]]; then
  echo "错误：API 请求失败"; echo "${RESPONSE_BODY}" | jq . 2>/dev/null || echo "${RESPONSE_BODY}"
  exit 1
fi

RULE_COUNT="$(echo "${RESPONSE_BODY}" | jq '.rules | length // 0')"
echo "rules 数量：${RULE_COUNT}"

echo "Network Rule ID 列表："
echo "${RESPONSE_BODY}" | jq -r '.rules[] | "  - \(.id)"'

echo "Network Rule 简要信息："
echo "${RESPONSE_BODY}" |
  jq -r '.rules[] | [.id, .from, .to, .ports, .action, .cfg_type] | @tsv' |
  awk 'BEGIN { printf "%-10s %-30s %-30s %-15s %-10s %-12s\n", "ID","FROM","TO","PORTS","ACTION","CFG_TYPE" }
       { printf "%-10s %-30s %-30s %-15s %-10s %-12s\n", $1,$2,$3,$4,$5,$6 }'
```

关键点：

- 用 `X-Auth-Apikey` 头完成认证，无需先登录换 token；
- 先校验 HTTP 状态码，再校验返回是否为合法 JSON，出错时把响应体打印出来，便于定位权限或接口问题；
- 网络规则在返回 JSON 的 `.rules` 数组里，每条规则包含 `id`、`from`、`to`、`ports`、`action`、`cfg_type` 等字段；
- 用 `jq` + `awk` 把结果整理成表格，一眼就能看清每条规则的来源和动作。

其中 `cfg_type` 字段很关键：它标识规则的来源。`learned` 表示 NeuVector 在学习模式下自动学习生成的规则，`user_created` 表示人工创建的规则。清理时通常只想删掉自动学习的那部分。

### 脚本二：批量删除 learned 规则（带二次确认）

第二个脚本在第一个的基础上，筛选出 `cfg_type == learned` 的规则并批量删除。删除不可逆，所以脚本加了多重保护：

```bash
#!/usr/bin/env bash
set -euo pipefail

CONTROLLER_API='https://<controller-ip>:10443'
X_AUTH_APIKEY='<你的APIKey名称>:<你的APIKey密钥>'
CONFIRM_TEXT='DELETE'

command -v curl >/dev/null 2>&1 || { echo "错误：未找到 curl"; exit 1; }
command -v jq   >/dev/null 2>&1 || { echo "错误：未找到 jq"; exit 1; }

# 1) 先获取全部规则
LIST_RESPONSE="$(
  curl -k -sS -w $'\n%{http_code}' \
    -H "X-Auth-Apikey: ${X_AUTH_APIKEY}" \
    -H "Accept: application/json" \
    "${CONTROLLER_API}/v1/policy/rule"
)"
LIST_HTTP_STATUS="${LIST_RESPONSE##*$'\n'}"
LIST_RESPONSE_BODY="${LIST_RESPONSE%$'\n'*}"

if [[ ! "${LIST_HTTP_STATUS}" =~ ^2[0-9][0-9]$ ]]; then
  echo "错误：获取 Network Rule 失败"; echo "${LIST_RESPONSE_BODY}" | jq . 2>/dev/null || echo "${LIST_RESPONSE_BODY}"
  exit 1
fi

# 2) 只挑出 cfg_type == learned 的规则 ID，排序去重
mapfile -t RULE_IDS < <(
  echo "${LIST_RESPONSE_BODY}" |
    jq -r '.rules[]? | select(.cfg_type == "learned") | .id // empty' |
    sort -n -u
)
[[ "${#RULE_IDS[@]}" -eq 0 ]] && { echo "没有 learned 规则可删。"; exit 0; }

# 3) 安全校验：所有 ID 必须是数字
for RULE_ID in "${RULE_IDS[@]}"; do
  [[ "${RULE_ID}" =~ ^[0-9]+$ ]] || { echo "发现非数字 Rule ID，已中止：${RULE_ID}"; exit 1; }
done

echo "即将删除 ${#RULE_IDS[@]} 条 learned 规则，此操作不可逆。"

# 4) 二次确认：必须手动输入 DELETE 才继续
read -r -p "如确认删除，请输入 ${CONFIRM_TEXT}: " USER_CONFIRM
[[ "${USER_CONFIRM}" == "${CONFIRM_TEXT}" ]] || { echo "已取消删除。"; exit 0; }

# 5) 逐条删除
for RULE_ID in "${RULE_IDS[@]}"; do
  echo "正在删除 Network Rule ID：${RULE_ID}"
  DELETE_RESPONSE="$(
    curl -k -sS -w $'\n%{http_code}' \
      -X DELETE \
      -H "X-Auth-Apikey: ${X_AUTH_APIKEY}" \
      -H "Accept: application/json" \
      -H "Content-Type: application/json" \
      "${CONTROLLER_API}/v1/policy/rule/${RULE_ID}"
  )"
  DELETE_HTTP_STATUS="${DELETE_RESPONSE##*$'\n'}"
  if [[ ! "${DELETE_HTTP_STATUS}" =~ ^2[0-9][0-9]$ ]]; then
    echo "错误：删除 ${RULE_ID} 失败"; echo "${DELETE_RESPONSE%$'\n'*}" | jq . 2>/dev/null
    exit 1
  fi
  echo "已删除：${RULE_ID}"
done

echo "所有 learned 规则删除完成。"
```

关键点：

- **只删 learned**：用 `jq` 的 `select(.cfg_type == "learned")` 精确筛选，避免误删人工创建的规则；
- **数字校验**：删除前逐个确认 Rule ID 都是数字，杜绝把异常值拼进删除 URL；
- **二次确认**：必须手动输入 `DELETE` 才会真正执行，给不可逆操作加一道人工闸门；
- **逐条删除并检查状态码**：每次 `DELETE /v1/policy/rule/{id}` 都单独判断 HTTP 状态，一旦失败立即停止并打印原因（常见于权限不足或规则已被占用）。

## 四、小结与注意事项

用 API Key 调用 NeuVector REST API 的完整链路很清晰：**暴露 Controller 的 10443 端口 → 控制台创建带最小权限的 API Key → 请求里携带 `X-Auth-Apikey` 头**。剩下的就是按 `apis.yaml` 里的接口定义去拼请求。

几点建议：

- **最小权限**：给 API Key 绑定刚好够用的角色，尤其是涉及删除等写操作的场景；
- **妥善保管 Secret**：创建时就复制保存，泄露或丢失都只能重建；并注意有效期；
- **特殊字符用单引号**：Shell 里给 API Key 赋值一定用单引号，避免被当变量解析；
- **证书**：`-k` 只适合测试；生产环境应配置受信任证书；
- **先只读再修改**：批量操作前先用只读脚本确认范围，删除类操作务必保留二次确认。

完整的接口定义（各版本的 `apis.yaml`）建议以 Swagger 阅读器打开查看。

## 参考

- NeuVector 官方文档 · Kubernetes 部署与暴露 REST API：<https://open-docs.neuvector.com/next/deploying/kubernetes#expose-rest-api-in-kubernetes>
- NeuVector 官方文档 · REST API 与自动化：<https://open-docs.neuvector.com/next/automation/automation>
- REST API 接口定义 apis.yaml：<https://github.com/neuvector/neuvector/blob/main/controller/api/apis.yaml>
