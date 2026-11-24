# Contributing

Thanks for taking a look at `dsh-plugin-omo`.

## Where the code lives

The source of truth is `packages/omo-dsh` in
[oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent). This repository distributes the built adapter and
the staged skills that the DeepSeek Harness loads.

## Development

```sh
git clone https://github.com/wunengbiao/dsh-plugin-omo.git
cd dsh-plugin-omo
npm run check
npm test
```

There is no install step and no runtime dependency. `index.js` and `lib/*.js` are generated and committed; after
changing `src/` run `bun run build` and commit the regenerated files together with the source.

## Reporting a problem

Include the DSH version (`dsh --version`), the profile you installed into, the output of
`dsh --profile <name> --dump-config | grep -A2 dsh-plugin-omo`, and the plugin log line
`[dsh-plugin-omo] registered provider ...` when it appears.
