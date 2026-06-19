---
title: "Linux 性能排查的第一组命令"
date: 2026-06-19
lastmod: 2026-06-19
description: "从 CPU、内存、磁盘、网络四个方向建立 Linux 性能排查的基础观察路径。"
slug: "linux-observability-basics"
categories: ["Linux"]
tags: ["Linux", "性能排查", "运维"]
series: "Linux 运维基础"
draft: false
featured: true
cover: "/images/tech-cover.svg"
author: "站点作者"
---

Linux 故障排查的第一步不是立刻修改配置，而是先建立足够清晰的观察面。CPU、内存、磁盘和网络通常能解释大多数系统层面的异常。

## CPU

使用 `top` 或 `htop` 可以快速判断系统是否存在 CPU 饱和。

```bash
top
uptime
mpstat 1
```

重点关注 load average、用户态 CPU、系统态 CPU、iowait 和上下文切换。如果 load 很高但 CPU 使用率不高，需要进一步判断是否存在 IO 阻塞。

## 内存

内存排查可以先看整体，再看进程。

```bash
free -h
vmstat 1
ps aux --sort=-%mem | head
```

Linux 会把空闲内存用于缓存，因此不能只看 free 数值。更重要的是 available、swap 使用量和持续增长的内存占用。

## 磁盘

磁盘问题常见表现是服务延迟升高。

```bash
df -h
iostat -xz 1
du -sh /var/log/*
```

如果 await、util、iowait 长时间偏高，需要进一步定位是哪个进程产生了大量读写。

## 网络

网络排查先确认连通性，再看端口和连接状态。

```bash
ip addr
ss -tunlp
curl -I https://example.com
```

生产环境中还需要关注 DNS、路由、防火墙、安全组和负载均衡配置。

## 总结

性能排查要先观察，再假设，最后验证。稳定的命令组合能减少盲目操作，也能让故障复盘更容易。

