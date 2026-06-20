
---
title: "Rancher Server一键安装脚本使用说明"
date: 2026-06-19
lastmod: 2026-06-20
description: "测试环境方便通过脚本一键安装prime和primegc版本Rancher"
slug: "rancher-install-shell"
categories: ["rancher"]
tags: ["rancher", "脚本", "自动化"]
series: ""
draft: false
featured: false
cover: "/images/tech-cover.svg"
author: "ivan"
---


## 一、文档说明

本文档用于说明 `install-rancher-server.sh` 的使用方法。

脚本功能：

-   自动安装 Helm
-   自动配置 RKE2 Ingress Nginx Forward Header
-   自动添加 Rancher Helm Repo
-   支持 Rancher Prim
-   支持 Rancher Prime GC
-   支持指定 Rancher 版本
-   支持指定 Rancher 域名
-   支持 Harbor 私有镜像仓库
-   支持 Helm Upgrade/Install

---

## 二、前置条件
### Kubernetes 集群
已安装并运行RKE2
验证：
```bash
kubectl get nodes
```
示例：
```text
NAME      STATUS   ROLES
node41    Ready    control-plane,etcd,master
```

---

### 域名准备
确保 Rancher 域名已解析到负载均衡或 Ingress 地址。
例如：
```text
rancher.rancherlsp.com
```
---

### 外部 TLS
当前环境使用Nginx + TLS
Rancher 配置：
```yaml
tls=external
```
脚本会自动配置：
```yaml
data:
  use-forwarded-headers: "true"
```
---

## 三、脚本功能

脚本执行过程：
```text
安装 Helm
        ↓
配置 ingress-nginx
        ↓
添加 Rancher Helm Repo
        ↓
更新 Repo
        ↓
部署 Rancher
        ↓
输出状态信息
```

---

## 四、默认参数

| 参数                     | 默认值                              |
| ------------------------ | ----------------------------------- |
| RANCHER_EDITION          | prime-gc                            |
| RANCHER_VERSION          | 2.13.0                              |
| RANCHER_GC_MINOR_VERSION | 2.13                                |
| MY_HOSTNAME              | rancher.rancherlsp.com              |
| PRIVATE_REGISTRY         | harbor.rancherlsp.com               |
| RANCHER_IMAGE            | harbor.rancherlsp.com/prime/rancher |
| HELM_VERSION             | v3.16.2                             |
| NAMESPACE                | cattle-system                       |
| REPLICAS                 | 1                                   |
| BOOTSTRAP_PASSWORD       | Rancher12345                        |
| TLS_MODE                 | external                            |
| RELEASE_NAME             | rancher                             |

---

## 五、Rancher install 脚本

### 拉取脚本命令
```bash
curl -fsSL https://raw.githubusercontent.com/wangzheivan/rancher-tools/refs/heads/main/rancher-install.sh -o rancher-install.sh
chmod +x rancher-install.sh
```
### 脚本内容
```bash
#!/usr/bin/env bash
set -euo pipefail


# =========================
# 可配置变量
# =========================

# prime 或 prime-gc
RANCHER_EDITION="${RANCHER_EDITION:-prime-gc}"

# Rancher Chart 版本，例如：2.13.0、2.12.3
RANCHER_VERSION="${RANCHER_VERSION:-2.13.0}"

# 仅 prime-gc 使用，用于拼接 charts.rancher.cn 仓库地址
# 例如：2.13 -> https://charts.rancher.cn/2.13-prime/latest
RANCHER_GC_MINOR_VERSION="${RANCHER_GC_MINOR_VERSION:-2.13}"

# Rancher 访问域名
MY_HOSTNAME="${MY_HOSTNAME:-rancher.rancherlsp.com}"

# Harbor 地址，仅 prime-gc 使用
PRIVATE_REGISTRY="${PRIVATE_REGISTRY:-harbor.rancherlsp.com}"

# Rancher 镜像，仅 prime-gc 使用
RANCHER_IMAGE="${RANCHER_IMAGE:-${PRIVATE_REGISTRY}/prime/rancher}"

# Helm 版本
HELM_VERSION="${HELM_VERSION:-v3.16.2}"

# Kubernetes Namespace
NAMESPACE="${NAMESPACE:-cattle-system}"

# Rancher 副本数
REPLICAS="${REPLICAS:-1}"

# 初始密码
BOOTSTRAP_PASSWORD="${BOOTSTRAP_PASSWORD:-Rancher12345}"

# TLS 模式
TLS_MODE="${TLS_MODE:-external}"

# Release 名称
RELEASE_NAME="${RELEASE_NAME:-rancher}"

# =========================
# 基础检查
# =========================
if [[ "$(id -u)" -ne 0 ]]; then
  echo "[ERROR] 请使用 root 用户执行"
  exit 1
fi

if [[ "${RANCHER_EDITION}" != "prime" && "${RANCHER_EDITION}" != "prime-gc" ]]; then
  echo "[ERROR] RANCHER_EDITION 只能是 prime 或 prime-gc"
  exit 1
fi

if ! command -v kubectl >/dev/null 2>&1; then
  echo "[ERROR] 未找到 kubectl，请先安装并配置好 RKE2 集群"
  exit 1
fi

if ! kubectl get nodes >/dev/null 2>&1; then
  echo "[ERROR] kubectl 无法访问当前 Kubernetes 集群"
  exit 1
fi

# =========================
# 配置 RKE2 Ingress Nginx 支持外部 TLS / X-Forwarded-* 头
# =========================
echo "[INFO] 配置 rke2-ingress-nginx-controller ConfigMap..."

kubectl -n kube-system patch configmap rke2-ingress-nginx-controller \
  --type merge \
  -p '{"data":{"use-forwarded-headers":"true"}}'

# =========================
# 安装 Helm
# =========================
if ! command -v helm >/dev/null 2>&1; then
  echo "[INFO] 安装 Helm ${HELM_VERSION}..."
  curl https://rancher-mirror.rancher.cn/helm/get-helm-3.sh | \
    INSTALL_HELM_MIRROR=cn \
    bash -s -- --version "${HELM_VERSION}"
else
  echo "[INFO] Helm 已存在：$(helm version --short)"
fi

# =========================
# 添加 Rancher Helm Repo
# =========================
if [[ "${RANCHER_EDITION}" == "prime" ]]; then
  RANCHER_REPO_URL="https://charts.rancher.com/server-charts/prime"
else
  RANCHER_REPO_URL="https://charts.rancher.cn/${RANCHER_GC_MINOR_VERSION}-prime/latest"
fi

echo "[INFO] Rancher Edition : ${RANCHER_EDITION}"
echo "[INFO] Rancher Version : ${RANCHER_VERSION}"
echo "[INFO] Rancher Repo    : ${RANCHER_REPO_URL}"
echo "[INFO] Hostname        : ${MY_HOSTNAME}"

helm repo add rancher-prime "${RANCHER_REPO_URL}" --force-update
helm repo update

# =========================
# 部署 Rancher
# =========================
if [[ "${RANCHER_EDITION}" == "prime" ]]; then

  echo "[INFO] 开始部署 Rancher Prime..."

  helm upgrade --install "${RELEASE_NAME}" rancher-prime/rancher \
    --namespace "${NAMESPACE}" \
    --create-namespace \
    --set hostname="${MY_HOSTNAME}" \
    --set replicas="${REPLICAS}" \
    --set global.cattle.psp.enabled=false \
    --set bootstrapPassword="${BOOTSTRAP_PASSWORD}" \
    --set tls="${TLS_MODE}" \
    --version "${RANCHER_VERSION}"

else

  echo "[INFO] 开始部署 Rancher Prime GC..."
  echo "[INFO] Private Registry : ${PRIVATE_REGISTRY}"
  echo "[INFO] Rancher Image    : ${RANCHER_IMAGE}"

  helm upgrade --install "${RELEASE_NAME}" rancher-prime/rancher \
    --namespace "${NAMESPACE}" \
    --create-namespace \
    --set hostname="${MY_HOSTNAME}" \
    --set replicas="${REPLICAS}" \
    --set global.cattle.psp.enabled=false \
    --set bootstrapPassword="${BOOTSTRAP_PASSWORD}" \
    --set rancherImage="${RANCHER_IMAGE}" \
    --set systemDefaultRegistry="${PRIVATE_REGISTRY}" \
    --set tls="${TLS_MODE}" \
    --version "${RANCHER_VERSION}"

fi

# =========================
# 输出状态
# =========================
echo
echo "======================================="
echo "Rancher Server 部署完成"
echo "======================================="
echo "Edition   : ${RANCHER_EDITION}"
echo "Version   : ${RANCHER_VERSION}"
echo "Namespace : ${NAMESPACE}"
echo "Hostname  : ${MY_HOSTNAME}"
echo "TLS       : ${TLS_MODE}"
echo "======================================="
echo
echo "查看 Pod："
echo "kubectl -n ${NAMESPACE} get pods"
echo
echo "查看 Helm Release："
echo "helm -n ${NAMESPACE} list"
```
创建脚本赋予权限：

```bash
vi install-rancher-server.sh
chmod +x install-rancher-server.sh
```
---

## 六、Prime GC 安装

默认执行：

```bash
./install-rancher-server.sh
```
等价于：
```bash
RANCHER_EDITION=prime-gc \
RANCHER_VERSION=2.13.0 \
RANCHER_GC_MINOR_VERSION=2.13 \
MY_HOSTNAME=rancher.rancherlsp.com \
./install-rancher-server.sh
```

脚本内部将执行：

```bash
helm repo add rancher-prime \
https://charts.rancher.cn/2.13-prime/latest
helm upgrade --install rancher \
rancher-prime/rancher
rancherImage=harbor.rancherlsp.com/prime/rancher
systemDefaultRegistry=harbor.rancherlsp.com
```

---

## 七、Prime 安装

执行：

```bash
RANCHER_EDITION=prime \
MY_HOSTNAME=rancher.rancherlsp.com \
RANCHER_VERSION=2.13.0 \
./install-rancher-server.sh
```

脚本将使用：

```bash
helm repo add rancher-prime \
https://charts.rancher.com/server-charts/prime
helm upgrade --install rancher
```
Prime 版本不会配置：
```yaml
rancherImage
systemDefaultRegistry
```
---


## 八、自定义 Harbor

默认：

```text
harbor.rancherlsp.com
```

如果 Harbor 地址发生变化：

```bash
PRIVATE_REGISTRY=harbor.example.com \
./install-rancher-server.sh
```

同时会自动更新：
```yaml
systemDefaultRegistry
```
以及：
```yaml
rancherImage
```
---

## 九、自定义管理员密码

修改：
```bash
BOOTSTRAP_PASSWORD='MyPassword@123' \
./install-rancher-server.sh
```
---
## 十、卸载 Rancher

卸载 Release：
```bash
helm uninstall rancher -n cattle-system
```
删除 Namespace：
```bash
kubectl delete ns cattle-system
```


