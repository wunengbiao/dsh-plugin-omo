# dsh-plugin-omo

把 [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent)（omo）的跨 harness 技能包，以 DSH 原生
`SkillProvider` 的形式接进 DeepSeek Harness 的插件。

插件向 `ctx.skills` 注册一个名为 `omo` 的 provider。注册之后，随包发布的技能与其它 DSH 技能没有区别：出现在会话
技能目录里、模型可以用 `skill` 工具加载、相对资源通过 `resourceBase` 解析。

## 这个版本提供什么

18 个技能，构建时从 `packages/shared-skills/skills` 复制：

`ast-grep`、`coding-agent-sessions`、`data-scientist`、`debugging`、`eval-integrity`、`frontend`、
`git-master`、`init-deep`、`lsp-setup`、`programming`、`refactor`、`remove-ai-slops`、`review-work`、
`ultimate-browsing`、`ulw-execute`、`ulw-plan`、`ulw-research`、`visual-qa`。

不发 `browser`：它的 omowright 库放在 `runtime/omowright`，那在源码树里是 gitignore 的构建产物，没跑过对应
stage 步骤时脚本会直接抛错。staging 脚本会跳过这类技能，并把原因写进 `skills/manifest.json`。

这个版本不做什么：不注册工具、不注册 agent preset、不挂 hook、不带 team mode。DSH 自带的工具面（grep、glob、
read、edit、write、bash、web、jobs、subagent、会话检索）已经覆盖了 omo 在别的 harness 里重写的那部分，重复实现只会
增加风险而不增加能力。

## 安装

发布产物在 [wunengbiao/dsh-plugin-omo](https://github.com/wunengbiao/dsh-plugin-omo)：

```sh
dsh plugin --profile web add github:wunengbiao/dsh-plugin-omo#v0.1.0
```

本包是那个分发仓库的源码真身，在这里构建得到同样的产物；从本地 checkout 安装也可以：

```sh
# 先构建，再装进命令行 profile（web / tui / headless）
cd packages/omo-dsh && bun run build
dsh plugin --profile web add "$(pwd)"

# 或者用 tarball
cd packages/omo-dsh && bun run build && pnpm pack
dsh plugin --profile web add ./dsh-plugin-omo-0.1.0.tgz
```

包内声明了 `dsh.bundle.patch`，所以 `dsh plugin add` 会把它追加进 `dsh.profile.bundles`，加载器随后把它挂成
`omo` 这一行。不启动也能验证：

```sh
dsh --profile web --dump-config | grep dsh-plugin-omo
```

重新启动应用（或重新 boot 该 profile），provider 才会在当前会话里注册。

### 桌面端

桌面 profile 归 Electron 应用所有，`dsh plugin --profile desktop` 拒绝组装它。开发期请改写桌面 profile 自己的
patch 层再重启应用：

```yaml
# ~/.dsh/profiles/desktop/cordis.patch.yml
- insert:
    - id: omo
      name: /absolute/path/to/packages/omo-dsh/lib/index.js
```

这是本地路径挂载。正式安装应走应用的插件管理器，让包被记进 profile manifest。

## 配置

配置是可选的，写在 `$DSH_HOME/profiles/<profile>/cordis.patch.yml` 的 `omo` 行上：

```yaml
- id: omo
  name: dsh-plugin-omo
  config:
    disabled: [ultimate-browsing, visual-qa]
```

| 键 | 类型 | 默认值 | 含义 |
|---|---|---|---|
| `providerName` | kebab-case 字符串 | `omo` | 技能注册表里的 provider 名，`runtime` 为保留名。 |
| `skillDir` | 字符串 | 包内 `skills/` | 最先扫描的技能根目录。 |
| `extraSkillDirs` | 字符串数组 | `[]` | 追加的技能根目录。 |
| `disabled` | 字符串数组 | `[]` | 从目录与 `get` 中隐藏的技能名。 |
| `rank` | 非负整数 | `600` | 同一注册层内同名技能的裁决权重，越小越优先。 |

未知键、类型错误、非 kebab-case 名称都会让插件加载失败，并给出指出问题的报错。

单个 SKILL.md 写坏不会让插件加载失败：该文档被跳过、路径写进日志，provider 上报不完整目录，其余技能照常可用。

读不了的技能根（权限、掉线的挂载点）只报错跳过，其余根照常服务；技能正文每次加载都重新读盘，改正文立即生效；新增或删除技能目录会让根监听触发目录失效，下一次查询就能看到，不用重启。

### 优先级

默认 rank 落在 bundled 档。DSH 的本地 provider 会先扫描 `<project>/.agents/skills`（rank 200）和用户根（400、
500），因此项目内或用户自己的同名技能会覆盖本插件随包发布的那份。同一层内两个插件争用同名技能时，先比 rank，
再比注册顺序。

## 技能为什么留在拥有它们的仓库里

`skills/` 是 `script/build-dsh-plugin.ts` 从 `packages/shared-skills/skills` 生成的，manifest 里记录每个文件的
sha256。`bun run build:check` 会 stage 到临时目录再与已提交的 manifest 比对：正文变化、新增技能、手改过的副本都会指出具体路径并失败，所以这个插件不可能悄悄发布一份过期的技能副本。

## 开发

```sh
cd packages/omo-dsh
bun run build        # 先 stage 技能，再把 src/ 打成 lib/index.js
bun test src         # 单元测试
bun run build:check  # 技能副本漂移检查
```

## 许可证

MIT
