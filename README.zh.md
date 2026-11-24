# dsh-plugin-omo

把 [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent)（omo）的跨 harness 技能包，以 DSH 原生
`SkillProvider` 的形式接进 DeepSeek Harness 的插件。

插件向 `ctx.skills` 注册一个名为 `omo` 的 provider。注册之后，随包发布的技能与其它 DSH 技能没有区别：出现在会话
技能目录里、模型可以用 `skill` 工具加载、相对资源通过 `resourceBase` 解析。

## 安装

```sh
dsh plugin --profile web add github:wunengbiao/dsh-plugin-omo#v0.1.0
```

锁 tag 很重要：这样后续的 push 不会悄悄改掉你机器上运行的代码。包里带的是已构建好的 JavaScript 和技能目录，安装时
不跑构建脚本，也不需要 pnpm 的 build 许可。

其它形式：

```sh
# 不锁版本，跟随 main
dsh plugin --profile web add github:wunengbiao/dsh-plugin-omo

# 从本地 checkout
git clone https://github.com/wunengbiao/dsh-plugin-omo.git
dsh plugin --profile web add ./dsh-plugin-omo
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
      name: /absolute/path/to/dsh-plugin-omo/index.js
```

这是本地路径挂载。正式安装应走应用的插件管理器，让包被记进 profile manifest。

## 这个版本提供什么

19 个技能，来自 oh-my-openagent 的 `packages/shared-skills/skills`：

`ast-grep`、`browser`、`coding-agent-sessions`、`data-scientist`、`debugging`、`eval-integrity`、`frontend`、
`git-master`、`init-deep`、`lsp-setup`、`programming`、`refactor`、`remove-ai-slops`、`review-work`、
`ultimate-browsing`、`ulw-execute`、`ulw-plan`、`ulw-research`、`visual-qa`。

这个版本不做什么：不注册工具、不注册 agent preset、不挂 hook、不带 team mode。DSH 自带的工具面（grep、glob、
read、edit、write、bash、web、jobs、subagent、会话检索）已经覆盖了 omo 在别的 harness 里重写的那部分，重复实现只会
增加风险而不增加能力。

## 配置

配置是可选的，写在 `$DSH_HOME/profiles/<profile>/cordis.patch.yml` 的 `omo` 行上：

```yaml
- id: omo
  name: dsh-plugin-omo
  config:
    disabled: [browser, ultimate-browsing]
```

| 键 | 类型 | 默认值 | 含义 |
|---|---|---|---|
| `providerName` | kebab-case 字符串 | `omo` | 技能注册表里的 provider 名，`runtime` 为保留名。 |
| `skillDir` | 字符串 | 包内 `skills/` | 最先扫描的技能根目录。 |
| `extraSkillDirs` | 字符串数组 | `[]` | 追加的技能根目录。 |
| `disabled` | 字符串数组 | `[]` | 从目录与 `get` 中隐藏的技能名。 |
| `rank` | 非负整数 | `600` | 同一注册层内同名技能的裁决权重，越小越优先。 |

未知键、类型错误、非 kebab-case 名称都会让插件加载失败，并给出指出问题的报错。

### 优先级

默认 rank 落在 bundled 档。DSH 的本地 provider 会先扫描 `<project>/.agents/skills`（rank 200）和用户根（400、
500），因此项目内或用户自己的同名技能会覆盖本插件随包发布的那份。同一层内两个插件争用同名技能时，先比 rank，
再比注册顺序。

## 开发

```sh
npm run check   # node --check 检查已提交的运行时模块
npm test        # node --test，对构建产物做端到端验证
bun run build   # 从 src/ 重新生成 index.js 与 lib/（仅维护者）
```

`index.js` 与 `lib/*.js` 是提交进仓库的，所以安装端不需要任何工具链。`src/` 是生成它们的 TypeScript 源码；
源码真身在 oh-my-openagent 的 `packages/omo-dsh`，`skills/` 也从那里的 `packages/shared-skills/skills` 同步。
两者一起重新生成，不要手改。

## 许可证

MIT
