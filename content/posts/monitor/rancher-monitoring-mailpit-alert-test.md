---
title: "Rancher Monitoring + Alertmanager + Mailpit 邮件告警测试实战"
date: 2026-10-24
lastmod: 2026-10-24
description: "使用 Rancher Monitoring、PrometheusRule、AlertmanagerConfig 和 Mailpit 验证 Kubernetes 邮件告警链路，涵盖中文 HTML 邮件、FIRING 与 RESOLVED 通知及常见问题排查。"
slug: "rancher-monitoring-mailpit-alert-test"
categories: ["monitor"]
tags: ["Prometheus", "Alertmanager", "Rancher Monitoring", "Mailpit", "Kubernetes"]
series: ""
draft: false
featured: false
cover: "/images/tech-cover.svg"
author: "Ivan"
---

> 文档版本：v1.0（初稿）  
> 测试日期：2026-10-24  
> 测试结论：**通过**。已在 Mailpit 中确认收到 `MailpitDeploymentUnavailable` 的 FIRING 告警及自定义中文 HTML 邮件；截图还显示多条 RESOLVED 通知。本文根据本次操作整理，个别选择器参数仍应以实际集群 YAML 为准。

## 1. 测试目标与环境

本次测试验证如下完整链路：

```text
测试 Deployment 异常
  → kube-state-metrics 采集工作负载指标
  → PrometheusRule 产生 FIRING 告警
  → AlertmanagerConfig 路由到邮件 Receiver
  → Mailpit SMTP 接收邮件
  → Mailpit Web UI 查看 FIRING / RESOLVED 通知
```

### 1.1 环境版本

| 组件 | 版本/地址 | 说明 |
|---|---|---|
| Rancher | `2.13.9` | 已部署，不介绍安装过程 |
| Kubernetes / RKE2 | Kubernetes `1.34.11` | 已部署，不介绍安装过程 |
| Rancher Monitoring | `108.0.8+up77.9.1-rancher.24` | 已部署，不介绍安装过程 |
| Mailpit | `axllent/mailpit` | Docker 方式部署；未固定镜像版本 |
| Mailpit Web UI | `http://192.168.50.41:8025/` | 浏览器查看捕获的邮件 |
| Mailpit SMTP | `192.168.50.41:1025` | Alertmanager 发送目标 |
| 测试集群 | `demo` | 实测邮件中显示的集群标签 |
| 测试命名空间 | `alert-mail-test` | 隔离测试对象 |

### 1.2 测试资源

| 资源 | 名称 | 命名空间 |
|---|---|---|
| Deployment | `mail-alert-test` | `alert-mail-test` |
| PrometheusRule | `mailpit-e2e-test` | `alert-mail-test` |
| AlertmanagerConfig | `mailpit-e2e` | `alert-mail-test` |
| Receiver | `alerts-test-41` | 属于上述 AlertmanagerConfig |
| 告警名称 | `MailpitDeploymentUnavailable` | 由 PrometheusRule 定义 |

## 2. 使用 Docker 部署 Mailpit

在内网服务器 `192.168.50.41` 上执行：

```bash
docker run -d \
  --restart unless-stopped \
  --name=mailpit \
  -p 8025:8025 \
  -p 1025:1025 \
  axllent/mailpit
```

说明：

| 参数 | 作用 |
|---|---|
| `-d` | 后台运行容器 |
| `--restart unless-stopped` | Docker/主机重启后自动恢复运行，手工停止的情况除外 |
| `--name=mailpit` | 指定容器名称 |
| `-p 8025:8025` | 映射 Web UI 端口 |
| `-p 1025:1025` | 映射 SMTP 端口 |
| `axllent/mailpit` | Mailpit 镜像；Docker 默认拉取 `latest` 标签 |

验证：

```bash
docker ps --filter name=mailpit
docker logs --tail 50 mailpit
```

浏览器打开 `http://192.168.50.41:8025/`，应显示 Mailpit 收件箱。

**重要**：Mailpit 是邮件捕获工具。测试地址 `alerts-test@example.com` 不需要真实邮箱账号；邮件只被 Mailpit 捕获，不代表已通过公网邮件服务投递。由于此部署没有持久化卷，容器重建后历史邮件不保证保留。建议仅在可信内网开放 8025/1025，生产化使用应增加访问控制及持久化。

## 3. 配置 AlertmanagerConfig

### 3.1 为什么使用 AlertmanagerConfig

`AlertmanagerConfig` 同时定义：

- **Receiver（接收器）**：通知发往哪里，例如 SMTP 邮箱。
- **Route（路由）**：哪些告警交给哪个 Receiver，以及通知分组和等待周期。

本次在 `alert-mail-test` 命名空间创建 `mailpit-e2e`。这样可以与测试 Deployment 使用相同命名空间，避免默认 `OnNamespace` 策略造成跨命名空间告警不匹配。

> 注意：`AlertmanagerConfig` 资源存在或显示 Active，并不必然证明 Alertmanager 已使用它。必须核实 Alertmanager CR 中的 `alertmanagerConfigSelector` 与 `alertmanagerConfigNamespaceSelector` 能选中此资源，并确认有效配置中存在其 Receiver/Route。

### 3.2 Receiver 邮件参数

| 字段（Rancher UI） | 本次值 | 说明 |
|---|---|---|
| Receiver Name | `alerts-test-41` | Route 必须引用相同名称 |
| Target | `alerts-test@example.com` | 收件人地址，**不是** Mailpit IP |
| Sender | `alertmanager@example.com` | 邮件发件人 |
| Host | `192.168.50.41:1025` | SMTP 主机和端口 |
| Use TLS | 不勾选 | 对应 `requireTLS: false`；适用当前无 TLS 的测试配置 |
| 认证用户名、密码 | 留空 | 当前 Mailpit 不要求认证 |
| Enable send resolved alerts | 勾选 | 故障恢复时发送 RESOLVED 邮件 |

### 3.3 Route 路由参数

| 字段 | 本次值 | 说明 |
|---|---|---|
| Receiver | `alerts-test-41` | 引用上面的邮件接收器 |
| Grouping / `groupBy` | `alertname` | 同一告警名称的多个实例分在一组 |
| Group Wait / `groupWait` | `5s` | 新告警组首次发送前等待 5 秒 |
| Group Interval / `groupInterval` | `30s` | 已存在告警组发生变化后的通知检查间隔 |
| Repeat Interval / `repeatInterval` | `10m` | 告警持续不恢复时，正常情况下每约 10 分钟再次提醒 |
| Matchers | 本次未配置 | 匹配本 AlertmanagerConfig 可处理范围内的所有告警 |

**Grouping 与 Matchers 不同**：Grouping 负责“如何合并通知”；Matchers 负责“哪些告警可以进入路由”。

**命名空间注意事项**：Prometheus Operator 默认采用 `OnNamespace` 策略，通常会将某个 AlertmanagerConfig 的路由限制到同命名空间的告警。因此本次把 AlertmanagerConfig 放在 `alert-mail-test`，与测试告警的 `namespace` 标签一致。如果你的集群自定义了匹配策略，应以实际生效配置为准。

**重复发送时间**：`repeatInterval: 10m` 不表示绝对定时每整 10 分钟发一封。Alertmanager 在 `groupInterval` 的检查点判断是否需要重复通知，且静默、抑制、路由变化等都会影响结果。正式生产环境建议按告警等级设置不同重复间隔。

### 3.4 完整 AlertmanagerConfig 示例（含中文邮件模板）

以下 YAML 是从本次配置整理出的精简版，可用于重新部署或复测。为方便阅读，省略了 Rancher 自动生成的大量注释及 Kubernetes 服务端字段（如 `uid`、`resourceVersion`）。

```yaml
apiVersion: monitoring.coreos.com/v1alpha1
kind: AlertmanagerConfig
metadata:
  name: mailpit-e2e
  namespace: alert-mail-test
spec:
  receivers:
    - name: alerts-test-41
      emailConfigs:
        - to: alerts-test@example.com
          from: alertmanager@example.com
          smarthost: 192.168.50.41:1025
          requireTLS: false
          sendResolved: true
          headers:
            - key: Subject
              value: >-
                【K8s告警】【{{ .Status | toUpper }}】
                {{ .CommonLabels.alertname }} - {{ .CommonLabels.cluster }}
          html: |
            <html>
            <body style="font-family:Arial,sans-serif;color:#333;">
              <h2 style="color:#e55353;">Kubernetes 监控告警</h2>
              <p><b>告警状态：</b>{{ .Status | toUpper }}</p>
              {{ range .Alerts }}
              <hr>
              <table style="width:100%;border-collapse:collapse;">
                <tr><td><b>告警名称</b></td><td>{{ .Labels.alertname }}</td></tr>
                <tr><td><b>所属集群</b></td><td>{{ .Labels.cluster }}</td></tr>
                <tr><td><b>告警级别</b></td><td>{{ .Labels.severity }}</td></tr>
                <tr><td><b>命名空间</b></td><td>{{ .Labels.namespace }}</td></tr>
                <tr><td><b>Deployment</b></td><td>{{ .Labels.deployment }}</td></tr>
                <tr><td><b>告警摘要</b></td><td>{{ .Annotations.summary }}</td></tr>
                <tr><td><b>详细描述</b></td><td>{{ .Annotations.description }}</td></tr>
                <tr><td><b>开始时间</b></td><td>{{ .StartsAt }}</td></tr>
                <tr><td><b>结束时间</b></td><td>{{ .EndsAt }}</td></tr>
              </table>
              {{ end }}
              <hr>
              <p style="font-size:12px;color:#888;">本邮件由 Rancher Monitoring / Alertmanager 自动发送。</p>
            </body>
            </html>
  route:
    receiver: alerts-test-41
    groupBy:
      - alertname
    groupWait: 5s
    groupInterval: 30s
    repeatInterval: 10m
```

应用：

```bash
kubectl apply --dry-run=server -f alertmanagerconfig-mailpit.yaml
kubectl apply -f alertmanagerconfig-mailpit.yaml
kubectl -n alert-mail-test get alertmanagerconfig mailpit-e2e
```

这里的 `alertmanagerconfig-mailpit.yaml` 是将上述配置保存到本地后的文件名。

#### 模板字段说明

| 模板表达式 | 作用 |
|---|---|
| `{{ .Status | toUpper }}` | 整个通知组的 FIRING / RESOLVED 状态 |
| `{{ .CommonLabels.alertname }}` | 当前告警组共有的名称 |
| `{{ .CommonLabels.cluster }}` | 当前告警组共有的集群名 |
| `{{ range .Alerts }}` | 遍历通知中的每一条告警 |
| `{{ .Labels.namespace }}` | 当前告警的 Kubernetes 命名空间 |
| `{{ .Labels.deployment }}` | 当前告警的 Deployment 名称 |
| `{{ .Annotations.summary }}` | PrometheusRule 中定义的摘要 |
| `{{ .Annotations.description }}` | PrometheusRule 中定义的描述 |
| `{{ .StartsAt }}` | 告警开始时间 |
| `{{ .EndsAt }}` | 告警结束时间；未恢复时可能是零值时间 |

`headers`、`html`、`to`、`from` 和 `smarthost` 必须处在同一个 `emailConfigs` 条目中，不能另建第二个 `spec` 或 `receivers`。此处使用 Alertmanager 的 Go Template 语法，与 PrometheusRule 内的规则注释模板作用阶段不同。

> 本次实测邮件的主题为 `【K8s告警】【FIRING】MailpitDeploymentUnavailable - demo`，HTML 正文包含告警状态、集群、级别、命名空间、Deployment、摘要、描述和时间。由于 `EndsAt` 在 FIRING 时尚无真实结束时间，实测页面显示了 `0001-01-01...`；后续生产化建议仅在 RESOLVED 状态展示结束时间，并将时间统一格式化为北京时间。

## 4. 创建快速触发的告警规则

默认 `KubeDeploymentReplicasMismatch` 等规则通常带有较长的 `for` 持续时间（如 15 分钟），更适合生产监控。为缩短本次验证时间，创建一条仅针对测试 Deployment 的 PrometheusRule，设置 `for: 0s`，无需等待 15 分钟持续条件。

### 4.1 PrometheusRule YAML

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: mailpit-e2e-test
  namespace: alert-mail-test
  labels:
    release: rancher-monitoring
spec:
  groups:
    - name: mailpit-e2e-test
      interval: 15s
      rules:
        - alert: MailpitDeploymentUnavailable
          expr: |
            kube_deployment_spec_replicas{
              namespace="alert-mail-test",
              deployment="mail-alert-test"
            }
            >
            kube_deployment_status_replicas_available{
              namespace="alert-mail-test",
              deployment="mail-alert-test"
            }
          for: 0s
          labels:
            severity: warning
            test: mailpit-e2e
          annotations:
            summary: Mailpit 邮件告警测试
            description: >-
              测试 Deployment {{ $labels.namespace }}/{{ $labels.deployment }}
              的可用副本数低于期望副本数。
```

核心字段：

- `expr`：比较期望副本数与可用副本数；期望值更大即满足告警条件。
- `for: 0s`：满足表达式后无需额外持续等待，下一次有效规则求值即可进入 FIRING。
- `interval: 15s`：规则组期望的求值间隔；最终以 Prometheus 实际加载结果为准。
- `severity: warning`：告警级别标签。
- `summary` / `description`：邮件模板读取的业务描述。

**关键：规则发现标签**。上例中的 `release: rancher-monitoring` 是示例标签，必须检查 Prometheus CR 的 `spec.ruleSelector` 与 `spec.ruleNamespaceSelector` 是否会选中该规则。不要只以 `kubectl apply` 成功作为规则已生效的证据。

创建并检查：

```bash
kubectl apply --dry-run=server -f prometheusrule-mailpit.yaml
kubectl apply -f prometheusrule-mailpit.yaml
kubectl -n alert-mail-test get prometheusrule mailpit-e2e-test
```

在 Rancher / Prometheus UI 的 **Rules** 页面找到 `MailpitDeploymentUnavailable`，以确认规则已被加载。

## 5. 创建用于触发告警的测试 Deployment

这里使用一个故意不存在的镜像，模拟 Deployment 无法启动。这样 Kubernetes 仍然期望有 1 个副本，但实际可用副本为 0，正好满足上面的告警表达式。

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mail-alert-test
  namespace: alert-mail-test
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mail-alert-test
  template:
    metadata:
      labels:
        app: mail-alert-test
    spec:
      containers:
        - name: nginx
          image: registry.invalid/mail-alert-test/not-exist:v1
          imagePullPolicy: Always
          resources:
            requests:
              cpu: 10m
              memory: 16Mi
```

创建：

```bash
kubectl create namespace alert-mail-test --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f deployment-mailpit-test.yaml
kubectl -n alert-mail-test get deployment,pods
```

预期 Deployment `READY=0/1`，Pod 可能出现 `ErrImagePull` 或 `ImagePullBackOff`。这是**故意制造的测试故障**，无需修复镜像。

> 建议执行顺序：先创建 Namespace，再配置 AlertmanagerConfig 和 PrometheusRule，确认均被选中后，最后创建异常 Deployment。若顺序调整，也可通过后续的规则求值触发告警。

## 6. 验证告警和邮件

### 6.1 Prometheus 指标与告警

在 Prometheus 查询：

```promql
kube_deployment_spec_replicas{namespace="alert-mail-test",deployment="mail-alert-test"}
```

预期值：`1`。

```promql
kube_deployment_status_replicas_available{namespace="alert-mail-test",deployment="mail-alert-test"}
```

预期值：`0`。

然后在 Alerts 页面观察 `MailpitDeploymentUnavailable` 变为 `FIRING`。使用本次 `for: 0s` 的测试规则，正常链路下通常可在数分钟内完成，不需要等待默认规则的 15 分钟持续期。

### 6.2 Alertmanager 路由

在 Alertmanager UI 检查是否存在该告警，且路由到了 Mailpit 邮件 Receiver。若 Prometheus 已 FIRING，但未收到邮件，重点检查：

1. AlertmanagerConfig 是否被 Alertmanager 的选择器选中。
2. 实际有效 Route 的命名空间匹配条件。
3. Receiver 名称是否与 Route 引用一致。
4. Alertmanager Pod 是否可以连接 `192.168.50.41:1025`。
5. 是否存在 Silence、Inhibition 或 SMTP 发送错误。

### 6.3 Mailpit 邮件验收（本次实测）

打开 `http://192.168.50.41:8025/`。

本次实测成功收到：

| 项目 | 实测结果 |
|---|---|
| From | `alertmanager@example.com` |
| To | `alerts-test@example.com` |
| Subject | `【K8s告警】【FIRING】MailpitDeploymentUnavailable - demo` |
| 告警名称 | `MailpitDeploymentUnavailable` |
| 集群 | `demo` |
| 告警级别 | `warning` |
| Namespace | `alert-mail-test` |
| Deployment | `mail-alert-test` |
| 内容 | 中文 HTML 表格，包含告警摘要、描述和时间 |
| 结论 | **通过** |

截图中还可见 `MailpitDeploymentUnavailable` 以及其他 Kubernetes 默认规则的 `RESOLVED` 邮件，说明本次邮箱接收链路已经同时捕获恢复通知。对于某一次单独的恢复流程，仍应结合对应告警的时间和标签进行核对。

## 7. 恢复告警与重复通知测试

测试规则 `for: 0s` 与路由 `groupWait: 5s` 使首次告警可以较快送达。但重复提醒遵循 `repeatInterval: 10m`，不是每 5 秒发送一次。

恢复方法：将测试 Deployment 缩容至 0，告警表达式不再成立。由于 Receiver 启用了 `sendResolved: true`，正常情况下会收到恢复通知。

```bash
kubectl -n alert-mail-test scale deployment/mail-alert-test --replicas=0
```

如需重新触发：

```bash
kubectl -n alert-mail-test scale deployment/mail-alert-test --replicas=1
```

注意：更改邮件模板本身不一定立即产生新通知。如果告警状态未变化，需等待重复通知周期，或通过缩容、扩容完成一次新的 FIRING/RESOLVED 测试。

## 8. 测试结束后的清理

建议先删除本次测试对象，避免持续的 ImagePullBackOff 和告警邮件：

```bash
kubectl -n alert-mail-test delete deployment mail-alert-test --ignore-not-found
kubectl -n alert-mail-test delete prometheusrule mailpit-e2e-test --ignore-not-found
kubectl -n alert-mail-test delete alertmanagerconfig mailpit-e2e --ignore-not-found
kubectl -n alert-mail-test get deployment,prometheusrule,alertmanagerconfig
```

**只有在确认 `alert-mail-test` 由本测试独占且没有其他资源时**，才删除整个 Namespace：

```bash
kubectl delete namespace alert-mail-test
```

Mailpit 容器可保留，用于后续邮件测试。若需要删除 Mailpit，应另行确认邮件记录是否需要保留。

## 9. 常见问题

| 现象 | 优先排查项 |
|---|---|
| PrometheusRule 创建成功但 Rules 页面找不到 | `ruleSelector`、`ruleNamespaceSelector`、规则 YAML 与 Operator 日志 |
| Deployment 为 0/1，但告警未触发 | kube-state-metrics 指标、PromQL 标签、规则是否被加载 |
| Prometheus FIRING，Mailpit 无邮件 | AlertmanagerConfig 选择器、Route、Namespace matcher、网络/SMTP |
| Mailpit 收到邮件但主题非常长 | 使用 `emailConfigs.headers` 自定义 `Subject` |
| 邮件正文只显示底层监控标签 | 使用 `emailConfigs.html` 和 `.Labels` / `.Annotations` 构建模板 |
| 修改模板后没有立即收到新邮件 | Alertmanager 去重、`repeatInterval`、告警是否发生状态变化 |
| FIRING 邮件结束时间为 `0001-01-01` | 告警尚未恢复，`.EndsAt` 是零值时间；模板应按状态条件显示 |
| YAML 报重复 mapping key | 不要在 `emailConfigs` 下新增第二个 `spec` / `receivers`；保留单个 Receiver 对象 |

## 10. 总结

本次在 Rancher 2.13.9、Kubernetes 1.34.11、rancher-monitoring `108.0.8+up77.9.1-rancher.24` 环境中，使用 Docker Mailpit 成功完成邮件告警端到端测试：

1. Mailpit 通过 Docker 暴露 SMTP `1025` 和 Web UI `8025`。
2. `AlertmanagerConfig` 定义 SMTP Receiver、Route、分组与通知间隔。
3. 自建 `PrometheusRule` 使用 `for: 0s` 快速检测 Deployment 副本不可用。
4. 测试 Deployment 使用故意不存在的镜像触发告警。
5. Mailpit 收到 FIRING 告警，并验证了自定义中文 HTML 邮件模板；收件箱中也可见 RESOLVED 通知。

此次验证表明：**Prometheus 规则评估 → Alertmanager 路由 → SMTP → Mailpit 收件** 这一链路在当前测试环境中能够正常工作。

## 11. 参考资料

- [Rancher Monitoring Chart（指定版本）](https://github.com/rancher/charts/tree/dev-v2.15/charts/rancher-monitoring/108.0.8%2Bup77.9.1-rancher.24)
- [Rancher Monitoring Receiver 配置](https://ranchermanager.docs.rancher.com/reference-guides/monitoring-v2-configuration/receivers)
- [Prometheus Alertmanager Configuration](https://prometheus.io/docs/alerting/latest/configuration/)
- [Prometheus Alertmanager Notification Template](https://prometheus.io/docs/alerting/latest/notifications/)
- [Prometheus Operator Alerting Routes](https://prometheus-operator.dev/docs/developer/alerting/)
- [Mailpit 官方仓库](https://github.com/axllent/mailpit)
