---
title: k8s跨节点网络排障：使用 Swiss Army Knife 构建 test-tool 工具集
slug: test-tool
description: Kubernetes 跨节点网络排障实践：使用 Swiss Army Knife 构建 test-tool 工具集
author: Ivan
draft: true
categories:
  - Kubernetes
tags:
  - 脚本
  - Kubernetes
series: ""
date: 2026-11-20T09:00:10.094Z
cover: /images/tech-cover.svg
image: /images/tech-cover.svg
lastmod: 2026-11-20T09:02:40.841Z
---
# Kubernetes 跨节点网络排障实践：使用 Swiss Army Knife 构建 test-tool 工具集

> 本文介绍如何基于 Rancher Swiss Army Knife 镜像，部署一组覆盖 Kubernetes 节点的排障 Pod，并使用 Shell 脚本检查跨节点 Pod 连通性、HTTP 访问、DNS 解析及 Kubernetes API Service 连通性。文末附上**完整 YAML 和 Shell 脚本**，可直接复制保存使用。
>
> **适用场景**：Kubernetes 集群网络排障、CNI 连通性验证、集群部署后的基础网络巡检。

## 一、背景与目标

Rancher 的 `support-tools` 项目提供过 `admin-tools.yaml` 和 `overlaytest.sh` 等排障工具。传统 Overlay 网络测试主要依赖 Pod 间 Ping 和 DNS 解析，但 ICMP 正常不代表 HTTP/TCP 一定可用。

这里采用 `rancherlabs/swiss-army-knife:latest` 镜像，利用其中的命令行工具和默认 HTTP Echo Server，构建一个简洁的 `test-tool` 排障环境。

**本文实现的能力**：

- 使用 DaemonSet 在符合调度条件的节点上部署测试 Pod。
- 默认执行**不同节点**上测试 Pod 之间的双向 Ping 和 HTTP `curl`。
- 可选检查集群内部 DNS、外部 DNS、Kubernetes API Service。
- 输出中文检查结果、按类别汇总失败数量，并可输出失败源 Pod 的 DNS 和网卡信息。
- 保留 NodePort `30080` 作为人工访问 Echo Server 的入口；**网络检查脚本不测试 NodePort**。

本文所有 Kubernetes 资源统一命名为 `test-tool`，命名空间也是 `test-tool`。

## 二、部署结构与工作原理

```text
Kubernetes 集群
├── Node A
│   └── Pod/test-tool-xxxxx  (HTTP Echo Server :80)
├── Node B
│   └── Pod/test-tool-yyyyy  (HTTP Echo Server :80)
└── Node C
    └── Pod/test-tool-zzzzz  (HTTP Echo Server :80)

本地执行 network-test.sh
    └── kubectl exec 进入每个测试 Pod
         ├── Ping 其他节点上的 Pod IP
         ├── curl http://其他节点PodIP:80/
         ├── [可选] nslookup 内部和外部域名
         └── [可选] curl Kubernetes API Service:443
```

测试由运行脚本的机器发起 `kubectl exec`，但真正的 Ping/Curl 请求发生在测试 Pod **内部**。所以脚本可以检查 Pod 网络视角的连通性，而不代表集群外部或用户终端的网络连通性。

**资源说明：**

| 资源                             | 名称        | 用途                               |
| -------------------------------- | ----------- | ---------------------------------- |
| Namespace                        | `test-tool` | 隔离测试资源                       |
| DaemonSet                        | `test-tool` | 每个符合调度条件的节点运行测试 Pod |
| ServiceAccount                   | `test-tool` | 提供 Pod 身份                      |
| ClusterRole + ClusterRoleBinding | `test-tool` | 赋予集群级排障权限                 |
| Service                          | `test-tool` | HTTP 80 → NodePort 30080           |

> **安全提示：** 此 YAML 为高权限排障方案：启用了 `privileged: true`、挂载宿主机 `/` 到容器 `/rootfs`，并授予近乎完整的集群操作权限。仅应在可信的运维环境中临时使用；通过防火墙、安全组等限制 NodePort 30080 的访问，并在测试完成后删除资源。NodePort 上的 HTTP Echo Server 不是 Web Shell，但 Pod 本身仍具有高权限。

## 三、部署 test-tool

### 3.1 环境要求

- 已有可用的 Kubernetes 集群，并可使用 `kubectl` 访问。
- 执行部署的身份具备创建 Namespace、ClusterRole、ClusterRoleBinding、ServiceAccount、DaemonSet 和 Service 的权限。
- 节点可拉取 `rancherlabs/swiss-army-knife:latest` 镜像。
- 至少两个节点运行 Ready 的测试 Pod，才能进行跨节点测试。
- 本地运行脚本需 Bash（支持关联数组，建议 Bash 4+）、`kubectl`，且拥有读取测试 Pod 和执行 `kubectl exec` 的权限。

### 3.2 保存部署清单

创建 `test-tool.yaml`，内容如下（完整文件）：

```yaml
# Kubernetes test-tool - Admin Tools with HTTP NodePort
# Adapted from rancherlabs/support-tools/swiss-army-knife/admin-tools.yaml
# WARNING: Grants cluster-admin-equivalent permissions and privileged host access.
# Restrict NodePort 30080 at the network/firewall layer. Remove after troubleshooting.
---
apiVersion: v1
kind: Namespace
metadata:
  name: test-tool
  labels:
    app: test-tool
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: test-tool
  labels:
    app: test-tool
rules:
  - apiGroups: ["*"]
    resources: ["*"]
    verbs: ["*"]
  - nonResourceURLs: ["*"]
    verbs: ["*"]
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: test-tool
  namespace: test-tool
  labels:
    app: test-tool
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: test-tool
  labels:
    app: test-tool
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: test-tool
subjects:
  - kind: ServiceAccount
    name: test-tool
    namespace: test-tool
---
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: test-tool
  namespace: test-tool
  labels:
    app: test-tool
spec:
  selector:
    matchLabels:
      app: test-tool
  template:
    metadata:
      labels:
        app: test-tool
    spec:
      serviceAccountName: test-tool
      tolerations:
        - operator: Exists
      containers:
        - name: test-tool
          image: rancherlabs/swiss-army-knife:latest
          imagePullPolicy: Always
          # Do not override CMD: the new image starts its HTTP echo server on port 80.
          ports:
            - name: http
              containerPort: 80
              protocol: TCP
          securityContext:
            privileged: true
          resources:
            requests:
              cpu: 100m
              memory: 100Mi
          env:
            - name: POD_NAMESPACE
              valueFrom:
                fieldRef:
                  fieldPath: metadata.namespace
            - name: POD_IP
              valueFrom:
                fieldRef:
                  fieldPath: status.podIP
            - name: NODE_NAME
              valueFrom:
                fieldRef:
                  fieldPath: spec.nodeName
          volumeMounts:
            - name: rootfs
              mountPath: /rootfs
      volumes:
        - name: rootfs
          hostPath:
            path: /
            type: Directory
---
apiVersion: v1
kind: Service
metadata:
  name: test-tool
  namespace: test-tool
  labels:
    app: test-tool
spec:
  type: NodePort
  selector:
    app: test-tool
  ports:
    - name: http
      protocol: TCP
      port: 80
      targetPort: http
      nodePort: 30080
```

### 3.3 部署并确认 Pod Ready

```bash
kubectl apply -f test-tool.yaml

# 等待 DaemonSet 就绪
kubectl -n test-tool rollout status daemonset/test-tool

# 查看测试 Pod 对应的节点及 IP
kubectl -n test-tool get pods -l app=test-tool -o wide

# 查看 Service
kubectl -n test-tool get svc test-tool
```

正常情况下，Service 的端口会显示类似 `80:30080/TCP`。不同节点应有各自的 Ready 测试 Pod。

> `imagePullPolicy: Always` 代表新 Pod 创建时会检查拉取镜像。生产/长期环境建议将 `latest` 固定为已验证的版本标签或镜像 Digest。

### 3.4 可选：人工访问 HTTP Echo Server

```bash
# 把地址替换为能够访问的节点 IP
curl http://<NODE_IP>:30080/
```

这仅验证客户端到 NodePort 的访问链路，不属于下文脚本的自动测试范围。若无法访问，请检查节点 IP、节点端口范围、防火墙或安全组等。

## 四、跨节点网络检查脚本

### 4.1 检查逻辑

脚本读取命名空间 `test-tool` 中标签为 `app=test-tool` 的 Ready Pod，并依据 Pod 所在 Node 分类。

- **跨节点 Ping**：从每个源 Pod Ping 不同节点上的目标 Pod IP；同节点 Pod 对默认跳过。
- **跨节点 HTTP**：从每个源 Pod 执行 `curl` 访问目标 Pod 的 `80` 端口；验证 HTTP 请求链路。
- **DNS（可选）**：在每个 Ready Pod 中解析 `kubernetes.default.svc` 和 `rancher.com`。
- **Service（可选）**：在每个 Ready Pod 中访问 `https://kubernetes.default.svc:443/`，检查 API Service 的 HTTPS 连通性。
- **故障附加信息（可选）**：失败时查看失败源 Pod 的 `/etc/resolv.conf` 和 `ip -brief addr`。

**注意：** 当前脚本的 HTTP 检查使用 `curl -f`，通常以 HTTP 状态码小于 400 作为成功条件，不是严格只接受 HTTP 200；脚本里的描述标签写有“HTTP 200”，实际判断仍以 `curl` 的退出码为准。API Service 检查则允许服务器返回 401/403，因为这些响应也表明 HTTP 服务可达。

### 4.2 保存脚本

创建 `network-test.sh`，完整内容如下：

```bash
#!/usr/bin/env bash
# Kubernetes test-tool 网络连通性检查
#
# 使用前提：集群中已部署 test-tool DaemonSet，容器使用
# rancherlabs/swiss-army-knife 镜像并运行其默认 HTTP Echo Server (80/TCP)。
# 本脚本只执行 kubectl 查询和 exec，不修改集群资源。
set -uo pipefail

NAMESPACE="test-tool"
SELECTOR="app=test-tool"
CONTAINER="test-tool"
TIMEOUT=5
CHECK_PING=true
CHECK_HTTP=true
CHECK_DNS=false
CHECK_SERVICE=false
DIAGNOSTICS=false
PASS=0
FAIL=0
SKIP=0

usage() {
  cat <<'EOF'
用法: ./network-test.sh [选项]

默认检查：不同节点的 Pod 相互 Ping + curl HTTP 80 端口。

  --all               执行所有检查：跨节点 Ping、HTTP、DNS、API Service
  --ping-check        开启跨节点 Ping 检查
  --http-check        开启跨节点 HTTP 80 检查（curl，要求返回 HTTP 200）
  --dns-check         开启内部和外部 DNS 检查
  --service-check     开启 Kubernetes API Service (443) 连通性检查
  --no-ping           关闭 Ping 检查，仅执行其他已选检查
  --no-http           关闭 HTTP 检查，仅执行其他已选检查
  --diagnostics       对失败的源 Pod 补充输出 DNS 配置和网络接口信息
  --namespace NAME    Pod 所在命名空间，默认 test-tool
  --selector LABEL    Pod 标签选择器，默认 app=test-tool
  --container NAME    容器名，默认 test-tool
  --timeout SECONDS   单次请求超时，默认 5 秒
  -h, --help          显示帮助

示例：
  ./network-test.sh
  ./network-test.sh --all
  ./network-test.sh --all --diagnostics
  ./network-test.sh --no-ping --dns-check --service-check

退出码：0 = 检查通过；1 = 有失败项；2 = 参数/环境错误或无测试执行。
注意：只验证 Pod 内部发出的连接；不会验证集群外部的 NodePort 入口。
EOF
}

error() { printf '错误：%s\n' "$*" >&2; }
while (( $# > 0 )); do
  case "$1" in
    --all) CHECK_PING=true; CHECK_HTTP=true; CHECK_DNS=true; CHECK_SERVICE=true; shift ;;
    --ping-check) CHECK_PING=true; shift ;;
    --http-check) CHECK_HTTP=true; shift ;;
    --dns-check) CHECK_DNS=true; shift ;;
    --service-check) CHECK_SERVICE=true; shift ;;
    --no-ping) CHECK_PING=false; shift ;;
    --no-http) CHECK_HTTP=false; shift ;;
    --diagnostics) DIAGNOSTICS=true; shift ;;
    --namespace|--selector|--container|--timeout)
      option="$1"
      (( $# >= 2 )) || { error "$option 缺少参数"; exit 2; }
      case "$option" in
        --namespace) NAMESPACE="$2" ;;
        --selector) SELECTOR="$2" ;;
        --container) CONTAINER="$2" ;;
        --timeout) TIMEOUT="$2" ;;
      esac
      shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) error "未知选项：$1"; usage; exit 2 ;;
  esac
done
[[ "$TIMEOUT" =~ ^[1-9][0-9]*$ ]] || { error '--timeout 必须为正整数'; exit 2; }
command -v kubectl >/dev/null 2>&1 || { error '找不到 kubectl'; exit 2; }

# 一次性查询所有 Pod，避免在测试循环中重复调用 Kubernetes API。
if ! pod_lines=$(kubectl -n "$NAMESPACE" get pods -l "$SELECTOR" \
  -o jsonpath='{range .items[*]}{.metadata.name}{"|"}{.spec.nodeName}{"|"}{.status.podIP}{"|"}{range .status.conditions[?(@.type=="Ready")]}{.status}{end}{"\n"}{end}' 2>&1); then
  error "查询 Pod 失败：$pod_lines"; exit 2
fi

PODS=(); NODES=(); IPS=()
while IFS='|' read -r name node ip ready; do
  [[ -n "$name" ]] || continue
  if [[ "$ready" == True && -n "$node" && -n "$ip" ]]; then
    PODS+=("$name"); NODES+=("$node"); IPS+=("$ip")
  else
    printf '提示：忽略未 Ready 的 Pod：%s (节点=%s, IP=%s)\n' "$name" "$node" "$ip"
    SKIP=$((SKIP + 1))
  fi
done <<< "$pod_lines"
(( ${#PODS[@]} > 0 )) || { error "命名空间 $NAMESPACE 中没有匹配 $SELECTOR 的 Ready Pod"; exit 2; }

# 使用 bash 位置参数传值，避免将 Pod IP/超时参数直接拼进远程命令。
remote() {
  local pod="$1" command="$2"
  shift 2
  kubectl -n "$NAMESPACE" exec "$pod" -c "$CONTAINER" -- bash -c "$command" _ "$@" 2>&1
}

# 将失败项保存起来，集中打印，避免大量原始命令输出影响阅读。
FAILED_ITEMS=()
FAILED_SOURCE=()
declare -A CAT_PASS=([PING]=0 [HTTP]=0 [DNS]=0 [SERVICE]=0)
declare -A CAT_FAIL=([PING]=0 [HTTP]=0 [DNS]=0 [SERVICE]=0)
record() {
  local category="$1" source_index="$2" description="$3" output="$4" rc="$5"
  if (( rc == 0 )); then
    printf '  [通过] %s\n' "$description"
    PASS=$((PASS + 1))
    CAT_PASS[$category]=$((CAT_PASS[$category] + 1))
  else
    printf '  [失败] %s\n' "$description"
    FAIL=$((FAIL + 1))
    CAT_FAIL[$category]=$((CAT_FAIL[$category] + 1))
    FAILED_ITEMS+=("[$category] ${PODS[$source_index]}：$description${output:+ | ${output//$'\n'/; }}")
    FAILED_SOURCE+=("$source_index")
  fi
}
run_check() {
  local category="$1" source_index="$2" description="$3" script="$4"
  shift 4
  local output rc
  output=$(remote "${PODS[$source_index]}" "$script" "$@"); rc=$?
  record "$category" "$source_index" "$description" "$output" "$rc"
}

printf '\n========== Kubernetes 网络检查 =========='\nprintf '\n命名空间: %s | Pod 选择器: %s | 超时: %ss\n' "$NAMESPACE" "$SELECTOR" "$TIMEOUT"
printf '\n[1] 测试 Pod 清单（只包含 Ready Pod）\n'
printf '  %-38s %-25s %s\n' 'POD' 'NODE' 'POD_IP'
for (( i=0; i<${#PODS[@]}; i++ )); do
  printf '  %-38s %-25s %s\n' "${PODS[$i]}" "${NODES[$i]}" "${IPS[$i]}"
done

printf '\n[2] 跨节点 Pod 网络检查\n'
if ! $CHECK_PING && ! $CHECK_HTTP; then
  printf '  已关闭 Ping 和 HTTP 检查\n'
else
  CROSS_PAIRS=0
  for (( src=0; src<${#PODS[@]}; src++ )); do
    for (( dst=0; dst<${#PODS[@]}; dst++ )); do
      [[ "${NODES[$src]}" == "${NODES[$dst]}" ]] && continue
      CROSS_PAIRS=$((CROSS_PAIRS + 1))
      target="${IPS[$dst]}"
      # IPv6 地址作为 URL host 时需要加方括号。
      url_host="$target"
      [[ "$target" == *:* ]] && url_host="[$target]"
      printf '  %s (%s) -> %s (%s)\n' "${PODS[$src]}" "${NODES[$src]}" "${PODS[$dst]}" "${NODES[$dst]}"
      if $CHECK_PING; then
        run_check PING "$src" "ICMP Ping $target" \
          'ping -c 1 -W "$1" "$2" >/dev/null' "$TIMEOUT" "$target"
      fi
      if $CHECK_HTTP; then
        # 只有 HTTP 200 才算通过；curl 也会检查 TCP 建连是否成功。
        run_check HTTP "$src" "curl http://${url_host}:80/ (HTTP 200)" \
          'curl --noproxy "*" -fsS --connect-timeout "$1" --max-time "$1" -o /dev/null "http://$2:80/"' \
          "$TIMEOUT" "$url_host"
      fi
    done
  done
  if (( CROSS_PAIRS == 0 )); then
    printf '  [跳过] 未发现跨节点 Pod 对（至少需要两个节点各有 Ready Pod）\n'
    SKIP=$((SKIP + 1))
  fi
fi

printf '\n[3] DNS 与 Service 检查\n'
if ! $CHECK_DNS && ! $CHECK_SERVICE; then
  printf '  默认不执行。使用 --all 或 --dns-check / --service-check 开启。\n'
else
  for (( src=0; src<${#PODS[@]}; src++ )); do
    printf '  来源 Pod：%s (%s)\n' "${PODS[$src]}" "${NODES[$src]}"
    if $CHECK_DNS; then
      run_check DNS "$src" '集群内部 DNS：kubernetes.default.svc' \
        'nslookup kubernetes.default.svc >/dev/null'
      run_check DNS "$src" '外部 DNS：rancher.com' \
        'nslookup rancher.com >/dev/null'
    fi
    if $CHECK_SERVICE; then
      # API Server 未认证请求可能返回 401/403；能完成 HTTPS 连接即说明网络通。
      run_check SERVICE "$src" 'Kubernetes API Service HTTPS:443' \
        'curl --noproxy "*" -ksS --connect-timeout "$1" --max-time "$1" -o /dev/null "https://kubernetes.default.svc:443/"' \
        "$TIMEOUT"
    fi
  done
fi

printf '\n[4] 汇总统计\n'
printf '  %-12s %6s %6s\n' '检查类别' '通过' '失败'
for category in PING HTTP DNS SERVICE; do
  printf '  %-12s %6d %6d\n' "$category" "${CAT_PASS[$category]}" "${CAT_FAIL[$category]}"
done
printf '  --------------------------------\n'
printf '  合计：通过 %d，失败 %d，跳过 %d\n' "$PASS" "$FAIL" "$SKIP"

if (( FAIL > 0 )); then
  printf '\n[5] 失败项明细（建议优先处理）\n'
  for item in "${FAILED_ITEMS[@]}"; do printf '  - %s\n' "$item"; done
  if $DIAGNOSTICS; then
    printf '\n[6] 失败源 Pod 的网络信息\n'
    declare -A seen=()
    for src in "${FAILED_SOURCE[@]}"; do
      [[ -n "${seen[$src]+yes}" ]] && continue
      seen[$src]=1
      printf '\n  --- %s ---\n' "${PODS[$src]}"
      remote "${PODS[$src]}" 'echo "[DNS 配置]"; cat /etc/resolv.conf; echo "[网络接口]"; ip -brief addr' || true
    done
  fi
fi

printf '\n'
if (( FAIL > 0 )); then
  printf '检查结束：存在 %d 项失败。\n' "$FAIL"; exit 1
fi
if (( PASS == 0 )); then
  error '没有实际执行任何检查。请确认至少两个节点有 Ready Pod，或开启 DNS/Service 检查。'
  exit 2
fi
printf '检查结束：所有已执行检查均通过。\n'
exit 0
```

### 4.3 执行命令

```bash
chmod +x network-test.sh

# 默认：跨节点 Ping + HTTP 80
./network-test.sh

# 全量：Ping + HTTP + DNS + API Service
./network-test.sh --all

# 全量检查，出现失败时输出源 Pod DNS 与网卡信息
./network-test.sh --all --diagnostics

# 只执行 HTTP 连通性，不执行 Ping
./network-test.sh --no-ping

# 单独执行 DNS 检查（关闭默认的 Ping 和 HTTP）
./network-test.sh --no-ping --no-http --dns-check

# 调整单次连接超时（秒）
./network-test.sh --all --timeout 10

# 查看全部参数
./network-test.sh --help
```

脚本的 `--all` 会开启四种主要检查；如果参数同时包含 `--no-ping` 或 `--no-http`，具体执行行为取决于参数出现顺序，应避免互相冲突的组合。

## 五、如何阅读输出

脚本将结果按以下顺序展示：

1. **测试 Pod 清单**：列出 Ready Pod、所在节点、Pod IP。
2. **跨节点 Pod 网络检查**：逐个展示源 Pod → 目标 Pod 的 Ping 和 HTTP 结果。
3. **DNS 与 Service 检查**：仅在启用相应选项时执行。
4. **汇总统计**：按 `PING`、`HTTP`、`DNS`、`SERVICE` 汇总通过与失败数量。
5. **失败项明细**：仅发生失败时输出；`--diagnostics` 还会显示失败源 Pod 的 DNS 和网卡信息。

例如，两个节点各有一个 Ready 测试 Pod，默认会产生两个方向的 Ping 和 HTTP 检查，共 4 项。下列结果仅是示例，并非实际集群的执行记录：

```text
========== Kubernetes 网络检查 ==========
命名空间: test-tool | Pod 选择器: app=test-tool | 超时: 5s

[1] 测试 Pod 清单（只包含 Ready Pod）
  POD                                    NODE                      POD_IP
  test-tool-aaaaa                        node-a                    10.42.0.10
  test-tool-bbbbb                        node-b                    10.42.1.10

[2] 跨节点 Pod 网络检查
  test-tool-aaaaa (node-a) -> test-tool-bbbbb (node-b)
  [通过] ICMP Ping 10.42.1.10
  [通过] curl http://10.42.1.10:80/ (HTTP 200)
  test-tool-bbbbb (node-b) -> test-tool-aaaaa (node-a)
  [通过] ICMP Ping 10.42.0.10
  [通过] curl http://10.42.0.10:80/ (HTTP 200)

[3] DNS 与 Service 检查
  默认不执行。使用 --all 或 --dns-check / --service-check 开启。

[4] 汇总统计
  检查类别         通过   失败
  PING              2      0
  HTTP              2      0
  DNS               0      0
  SERVICE           0      0
  --------------------------------
  合计：通过 4，失败 0，跳过 0

检查结束：所有已执行检查均通过。
```

**退出码说明：**

| 退出码 | 含义                                                   |
| ------ | ------------------------------------------------------ |
| `0`    | 所有实际执行的测试均通过                               |
| `1`    | 存在至少一个失败项                                     |
| `2`    | 参数/环境错误、没有 Ready 测试 Pod，或没有实际执行测试 |

其中 `跳过` 不等于测试成功。例如，仅单节点时没有跨节点 Pod 对，不能据此判断跨节点网络正常。

## 六、常见问题排查

### 6.1 Pod 不 Ready

```bash
kubectl -n test-tool get pods -o wide
kubectl -n test-tool describe daemonset test-tool
kubectl -n test-tool describe pod <POD_NAME>
kubectl -n test-tool logs <POD_NAME> -c test-tool
```

先排查镜像拉取、调度、容器启动和 Pod 就绪状态。测试脚本只纳入 Ready 的 Pod。

### 6.2 Ping 成功，但 HTTP 失败

这说明 ICMP 可以通过，但 HTTP/TCP 链路仍有问题。重点检查目标 Pod 的 Echo Server 是否监听 80 端口、Pod 网络策略、CNI 转发和相关防火墙规则。

```bash
kubectl -n test-tool exec -it <POD_NAME> -c test-tool -- bash

# 进入容器后
ss -lnt
curl -v http://<OTHER_POD_IP>:80/
```

### 6.3 内部 DNS 失败

```bash
kubectl -n test-tool get pods -l app=test-tool -o wide
kubectl -n kube-system get pods
kubectl -n test-tool exec -it <POD_NAME> -c test-tool -- bash
```

进入容器后：

```bash
cat /etc/resolv.conf
nslookup kubernetes.default.svc
```

结合集群实际的 CoreDNS/kube-dns 部署、DNS Service 及网络策略进一步诊断。

### 6.4 Service 检查失败

脚本访问的是 Kubernetes 默认的 API Service `kubernetes.default.svc:443`，并非 test-tool 的 NodePort。可检查默认 Service 及其 EndpointSlice：

```bash
kubectl -n default get svc kubernetes
kubectl -n default get endpointslices -l kubernetes.io/service-name=kubernetes
```

不同集群可能使用不同的 Service 转发实现，不应仅凭这项结果直接断定是 kube-proxy 故障。

## 七、安全与清理

本部署刻意保留了 Rancher 管理排障工具的高权限能力，并不适合作为长期暴露的公共网络测试服务。

**完成排障后建议及时移除：**

```bash
kubectl delete -f test-tool.yaml
```

如果仅需暂时禁止 NodePort 外部访问，应在防火墙/安全组层面收紧访问；不要把高权限测试环境当作普通 Web 服务长期对外开放。

如果先前还安装过旧的 `swiss-army-knife` 命名空间与工作负载，应先确认是否仍有其他用途，再按实际资源逐项清理；新旧命名空间互不自动替换。

## 八、参考项目

- Rancher Support Tools：<https://github.com/rancherlabs/support-tools/tree/master/swiss-army-knife>
- 原始 Admin Tools YAML：<https://github.com/rancherlabs/support-tools/blob/master/swiss-army-knife/admin-tools.yaml>
- 原始 Overlay Test Script：<https://github.com/rancherlabs/support-tools/blob/master/swiss-army-knife/overlaytest.sh>
- Swiss Army Knife v2：<https://github.com/rancherlabs/swiss-army-knife-v2>
- Docker Hub 镜像：<https://hub.docker.com/r/rancherlabs/swiss-army-knife>

---

**总结：** 使用 `test-tool.yaml` 提供分布在不同节点的 HTTP Echo Server 测试端点，使用 `network-test.sh` 从每个测试 Pod 向其他节点的 Pod 发起 Ping 和 HTTP 请求，并按需补充 DNS 和 API Service 检查。它适合快速发现“Pod 能 Ping 但不能 Curl”、跨节点单向故障，以及 DNS/Service 访问异常等常见问题。