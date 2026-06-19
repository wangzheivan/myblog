---
title: "Kubernetes 工作负载的最小理解模型"
date: 2026-06-18
lastmod: 2026-06-19
description: "用 Deployment、Service、ConfigMap 和 Ingress 串起 Kubernetes 应用发布的基本路径。"
slug: "kubernetes-workload-overview"
categories: ["云原生"]
tags: ["Kubernetes", "容器", "云原生"]
series: "Kubernetes 入门到实践"
draft: false
featured: true
cover: "/images/tech-cover.svg"
author: "站点作者"
---

Kubernetes 的对象很多，但初学时可以先把应用发布理解成几个核心对象之间的协作。

## Deployment

Deployment 描述应用副本、镜像版本和滚动更新策略。它负责把期望状态持续同步到集群中。

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: demo-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: demo-api
  template:
    metadata:
      labels:
        app: demo-api
    spec:
      containers:
        - name: api
          image: nginx:1.27
```

## Service

Pod 会变化，Service 提供稳定访问入口。应用之间通常不直接访问 Pod IP，而是访问 Service。

## ConfigMap

ConfigMap 用于保存非敏感配置，例如日志级别、开关项、普通配置文件。敏感信息应使用 Secret 或外部密钥系统。

## Ingress

Ingress 把集群外部流量转发到集群内部服务，通常和 Nginx Ingress Controller、Traefik 或云厂商网关配合使用。

## 总结

第一阶段可以记住一条主线：Deployment 运行应用，Service 暴露稳定入口，ConfigMap 注入配置，Ingress 接入外部流量。

