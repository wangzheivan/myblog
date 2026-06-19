---
title: "SUSE Observability 安装部署文档"
date: 2026-06-19
lastmod: 2026-06-19
description: "测试环境SUSE Observability 安装部署文档"
slug: "o11y-install"
categories: ["Observability"]
tags: ["Observability", "部署"]
series: ""
draft: false
featured: false
cover: "/images/tech-cover.svg"
author: "ivan"
---



## 1. 文档说明

本文档用于指导在 RKE2 Kubernetes 集群中安装 SUSE Observability。安装过程包含 Longhorn 存储环境准备、离线/私有镜像仓库镜像准备、证书准备、Helm values 配置以及 SUSE Observability 安装。

> 说明：本文中的域名、IP、Harbor 地址、用户名、密码、License Key 等均为示例或现场环境值。生产环境中请根据实际情况替换，并避免将明文密码提交到代码仓库或共享文档中。

## 2. 环境信息

| 项目 | 示例值 |
|---|---|
| Kubernetes 发行版 | RKE2 |
| 存储方案 | Longhorn |
| SUSE Observability Chart 版本 | `2.10.1` |
| SUSE Observability Namespace | `suse-observability` |
| Longhorn Namespace | `longhorn-system` |
| 私有镜像仓库 | `harbor.rancherlsp.com` |
| SUSE Observability 访问域名 | `o11y.rancherlsp.com` |
| OTLP gRPC 域名 | `o11y-otlp.rancherlsp.com` |
| OTLP HTTP 域名 | `o11y-otlp-http.rancherlsp.com` |
| TLS Secret 名称 | `suse-o11y-tls` |

## 3. 前置条件

安装前请确认以下条件已满足：

1. RKE2 集群已正常运行。
2. `kubectl` 可正常访问目标集群。
3. Helm 已安装并可正常使用。
4. Rancher UI 可访问，用于部署 Longhorn。
5. Harbor 私有镜像仓库已部署完成，并可从集群节点访问。
6. 已准备 SUSE Observability License Key。
7. 已准备 DNS 解析或本地 hosts 解析，例如：

```text
192.168.50.22 o11y.rancherlsp.com
192.168.50.22 o11y-otlp.rancherlsp.com
192.168.50.22 o11y-otlp-http.rancherlsp.com
```

> 如 Ingress VIP 或 LoadBalancer IP 不是 `192.168.50.22`，请按实际地址调整。

---

## 4. 准备 Longhorn 环境

### 4.1 安装 longhornctl

在可访问 Kubernetes 集群的节点上执行以下命令：

```bash
curl -L https://github.com/longhorn/cli/releases/download/v1.12.0/longhornctl-linux-amd64 -o longhornctl
chmod +x longhornctl
mv ./longhornctl /usr/local/bin/longhornctl
```

### 4.2 创建 Longhorn Namespace

```bash
kubectl create namespace longhorn-system
```

如 namespace 已存在，可忽略相关提示。

### 4.3 设置 KUBECONFIG

```bash
export KUBECONFIG=/root/.kube/config
```

### 4.4 执行 Longhorn 预检查

```bash
longhornctl install preflight
longhornctl check preflight
```

请确认预检查结果无阻断性错误。如存在缺失依赖、内核模块或系统配置问题，请先根据提示修复。

### 4.5 通过 Rancher UI 部署 Longhorn

完成预检查后，在 Rancher UI 中部署 Longhorn：

1. 登录 Rancher UI。
2. 进入目标 RKE2 集群。
3. 进入 Apps / Charts。
4. 搜索并选择 Longhorn。
5. 安装到 `longhorn-system` namespace。
6. 配置项保持默认即可。
7. 等待 Longhorn 相关 Pod 全部 Running。

验证 Longhorn 状态：

```bash
kubectl -n longhorn-system get pods
kubectl get storageclass
```

确认存在 Longhorn StorageClass，并且 Longhorn 组件运行正常。

---

## 5. 镜像准备

本步骤建议在 Harbor 节点或可同时访问互联网与 Harbor 的节点上操作。

### 5.1 添加 SUSE Observability Helm 仓库

```bash
helm repo add suse-observability https://charts.rancher.com/server-charts/prime/suse-observability
helm repo update
```

### 5.2 下载 SUSE Observability Chart

```bash
helm fetch suse-observability/suse-observability --version 2.10.1
```

下载完成后，当前目录下会生成类似文件：

```text
suse-observability-2.10.1.tgz
```

### 5.3 下载 values helper chart

```bash
helm fetch suse-observability/suse-observability-values --version 2.10.1
```

下载完成后，当前目录下会生成类似文件：

```text
suse-observability-values-2.10.1.tgz
```

> 实际文件名以 Helm 下载结果为准。

### 5.4 下载镜像处理脚本

```bash
curl -LO https://raw.githubusercontent.com/StackVista/helm-charts/master/stable/suse-observability/installation/o11y-get-images.sh
curl -LO https://raw.githubusercontent.com/StackVista/helm-charts/master/stable/suse-observability/installation/o11y-save-images.sh
curl -LO https://raw.githubusercontent.com/StackVista/helm-charts/master/stable/suse-observability/installation/o11y-load-images.sh
```

### 5.5 添加脚本执行权限

```bash
chmod a+x o11y-get-images.sh o11y-save-images.sh o11y-load-images.sh
```

### 5.6 提取镜像列表

```bash
./o11y-get-images.sh -f suse-observability-2.10.1.tgz > o11y-images.txt
```

检查镜像列表：

```bash
cat o11y-images.txt
```

### 5.7 配置 Harbor 认证信息

```bash
export DST_REGISTRY_USERNAME="admin"
export DST_REGISTRY_PASSWORD="<Harbor 管理员密码>"
```

> 请将 `<Harbor 管理员密码>` 替换为实际 Harbor 密码。生产环境不建议在 shell history 中保留明文密码。

### 5.8 推送镜像到 Harbor

根据实际环境选择镜像同步方式。通常流程为：

1. 从源镜像仓库拉取 SUSE Observability 所需镜像。
2. 保存镜像为离线包，或直接重新打标签。
3. 推送到 Harbor 私有仓库。
4. 确认 Harbor 中已存在对应镜像。

示例操作可参考下载的脚本帮助信息：

```bash
./o11y-save-images.sh --help
./o11y-load-images.sh --help
```

如目标环境为完全离线环境，建议在联网节点执行镜像保存，在离线 Harbor 节点执行镜像加载与推送。

---

## 6. 安装 SUSE Observability

以下步骤在 RKE2 集群管理节点上执行。

### 6.1 添加 Helm 仓库

```bash
helm repo add suse-observability https://charts.rancher.com/server-charts/prime/suse-observability
helm repo update
```

### 6.2 创建 Namespace

```bash
kubectl create namespace suse-observability
```

如 namespace 已存在，可忽略相关提示。

---

## 7. 准备 TLS 证书

### 7.1 生成自签名证书

执行以下命令生成自签名证书：

```bash
./create_self-signed-cert.sh \
  --ssl-domain=o11y.rancherlsp.com \
  --ssl-trusted-domain=o11y-otlp.rancherlsp.com,o11y-otlp-http.rancherlsp.com \
  --ssl-trusted-ip=192.168.50.22,192.168.50.23,192.168.50.24 \
  --ssl-size=2048 \
  --ssl-date=3650
```

生成后应得到以下文件：

```text
tls.crt
tls.key
```

### 7.2 创建 Kubernetes TLS Secret

```bash
kubectl -n suse-observability create secret tls suse-o11y-tls \
  --cert=tls.crt \
  --key=tls.key
```

验证 Secret：

```bash
kubectl -n suse-observability get secret suse-o11y-tls
```

---

## 8. 准备 Helm Values

### 8.1 创建 `values.yaml`

创建 `values.yaml` 文件：

```yaml
global:
  # 可选：覆盖默认镜像仓库。
  # 默认镜像仓库为 registry.rancher.com。
  # 离线环境或使用私有镜像仓库时需要配置该参数。
  imageRegistry: "harbor.rancherlsp.com"

  suseObservability:
    # 必填：SUSE Observability License Key
    license: "<SUSE Observability License Key>"

    # 必填：SUSE Observability 访问地址
    baseUrl: "https://o11y.rancherlsp.com"

    # 必填：规格配置
    # 可选值：trial, 10-nonha, 20-nonha, 50-nonha, 100-nonha,
    #        150-ha, 250-ha, 500-ha, 4000-ha
    sizing:
      profile: "trial"

    # 必填：管理员明文密码
    # 生产环境建议使用 adminPasswordBcrypt 替代明文密码
    adminPassword: "<Admin Password>"

    # 如需使用 bcrypt 加密密码，可使用以下方式生成：
    # htpasswd -bnBC 10 "" "your-password" | tr -d ':\n'
    # adminPasswordBcrypt: "$2a$10$..."

    # 可选：Receiver API Key，不配置时自动生成
    # receiverApiKey: "your-receiver-api-key"

    # 可选：Pod 调度亲和性配置
    # affinity:
    #   nodeAffinity: ...
    #   podAntiAffinity:
    #     requiredDuringSchedulingIgnoredDuringExecution: true
```

> 请将 `<SUSE Observability License Key>` 与 `<Admin Password>` 替换为实际值。

### 8.2 创建 `ingress_values.yaml`

创建 `ingress_values.yaml` 文件：

```yaml
ingress:
  enabled: true
  annotations:
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
  hosts:
    - host: o11y.rancherlsp.com
  tls:
    - hosts:
        - o11y.rancherlsp.com
      secretName: suse-o11y-tls
```

---

## 9. 执行 Helm 安装

执行以下命令安装 SUSE Observability：

```bash
helm upgrade \
  --install \
  --version 2.10.1 \
  --namespace suse-observability \
  --values values.yaml \
  --values ingress_values.yaml \
  suse-observability \
  suse-observability/suse-observability
```

---

## 10. 安装后验证

### 10.1 查看 Helm Release

```bash
helm -n suse-observability list
helm -n suse-observability status suse-observability
```

### 10.2 查看 Pod 状态

```bash
kubectl -n suse-observability get pods
```

等待所有核心组件变为 `Running` 或 `Completed`。

如需持续观察：

```bash
kubectl -n suse-observability get pods -w
```

### 10.3 查看 Service 与 Ingress

```bash
kubectl -n suse-observability get svc
kubectl -n suse-observability get ingress
```

确认 Ingress 中存在 `o11y.rancherlsp.com`，并绑定到正确的 Ingress Controller 地址。

### 10.4 浏览器访问

访问：

```text
https://o11y.rancherlsp.com
```

使用安装时配置的管理员账号密码登录。

> 管理员密码为 `values.yaml` 中 `global.suseObservability.adminPassword` 配置的值。

---

## 11. 常用排障命令

### 11.1 查看异常 Pod

```bash
kubectl -n suse-observability get pods
kubectl -n suse-observability describe pod <pod-name>
```

### 11.2 查看 Pod 日志

```bash
kubectl -n suse-observability logs <pod-name>
```

如 Pod 内有多个容器：

```bash
kubectl -n suse-observability logs <pod-name> -c <container-name>
```

### 11.3 查看事件

```bash
kubectl -n suse-observability get events --sort-by=.metadata.creationTimestamp
```

### 11.4 检查镜像拉取问题

如 Pod 出现 `ImagePullBackOff` 或 `ErrImagePull`，请检查：

1. `global.imageRegistry` 是否配置为正确的 Harbor 地址。
2. Harbor 中是否已存在所需镜像。
3. 集群节点是否可访问 Harbor。
4. Harbor 证书是否被节点信任。
5. 是否需要配置 imagePullSecret。

### 11.5 检查 Ingress 访问问题

如无法访问 `https://o11y.rancherlsp.com`，请检查：

```bash
kubectl -n suse-observability get ingress
kubectl -n suse-observability describe ingress
kubectl -n ingress-nginx get pods
```

同时确认：

1. DNS 或 hosts 是否正确解析到 Ingress 地址。
2. TLS Secret `suse-o11y-tls` 是否存在。
3. Ingress Controller 是否正常运行。
4. 防火墙是否放通 80/443 端口。

### 11.6 检查 Longhorn 存储问题

```bash
kubectl -n longhorn-system get pods
kubectl get storageclass
kubectl get pvc -A
```

如 PVC 无法绑定，请确认 Longhorn StorageClass 正常，并检查 Longhorn UI 中的卷状态。

---

## 12. 卸载方法

如需卸载 SUSE Observability，可执行：

```bash
helm -n suse-observability uninstall suse-observability
```

如确认不再需要该 namespace，可删除：

```bash
kubectl delete namespace suse-observability
```

> 删除 namespace 会清理其中的资源。生产环境请先确认数据备份和持久化卷处理策略。

---

## 13. 安装流程汇总

```bash
# 1. 准备 Longhorn
curl -L https://github.com/longhorn/cli/releases/download/v1.12.0/longhornctl-linux-amd64 -o longhornctl
chmod +x longhornctl
mv ./longhornctl /usr/local/bin/longhornctl
kubectl create namespace longhorn-system
export KUBECONFIG=/root/.kube/config
longhornctl install preflight
longhornctl check preflight

# 2. 在 Rancher UI 中部署 Longhorn，配置保持默认

# 3. 下载 SUSE Observability Chart 与镜像脚本
helm repo add suse-observability https://charts.rancher.com/server-charts/prime/suse-observability
helm repo update
helm fetch suse-observability/suse-observability --version 2.10.1
helm fetch suse-observability/suse-observability-values --version 2.10.1
curl -LO https://raw.githubusercontent.com/StackVista/helm-charts/master/stable/suse-observability/installation/o11y-get-images.sh
curl -LO https://raw.githubusercontent.com/StackVista/helm-charts/master/stable/suse-observability/installation/o11y-save-images.sh
curl -LO https://raw.githubusercontent.com/StackVista/helm-charts/master/stable/suse-observability/installation/o11y-load-images.sh
chmod a+x o11y-get-images.sh o11y-save-images.sh o11y-load-images.sh
./o11y-get-images.sh -f suse-observability-2.10.1.tgz > o11y-images.txt

# 4. 创建 SUSE Observability namespace
kubectl create namespace suse-observability

# 5. 创建 TLS Secret
kubectl -n suse-observability create secret tls suse-o11y-tls \
  --cert=tls.crt \
  --key=tls.key

# 6. 安装 SUSE Observability
helm upgrade \
  --install \
  --version 2.10.1 \
  --namespace suse-observability \
  --values values.yaml \
  --values ingress_values.yaml \
  suse-observability \
  suse-observability/suse-observability
```

