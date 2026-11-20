/**
 * Powerline footer modelled on omp's status line (Nerd Font required).
 * Left:  model+thinking · path · git branch · extension statuses
 * Right: session name · tokens · cost · context %
 * /powerline toggles it. Enabled by default.
 */
import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { homedir } from "node:os";

const SEP = "\uE0B1"; // powerline thin
const ICON = { model: "\uF4B8", dir: "\uF07B", branch: "\uE0A0", ctx: "\uF2DB", cost: "\uF155", tok: "\uF0AE" };

const fmt = (n: number) => (n < 1000 ? `${n}` : n < 1e6 ? `${(n / 1000).toFixed(1)}k` : `${(n / 1e6).toFixed(1)}M`);

function shortPath(cwd: string, max = 40): string {
	const home = homedir();
	const p = cwd.startsWith(home) ? "~" + cwd.slice(home.length) : cwd;
	if (p.length <= max) return p;
	return "…/" + p.split("/").slice(-2).join("/");
}

export default function (pi: ExtensionAPI) {
	let enabled = true;

	const install = (ctx: ExtensionContext) => {
		if (!ctx.hasUI) return;
		ctx.ui.setFooter((tui, theme, footerData) => {
			const unsub = footerData.onBranchChange(() => tui.requestRender());
			const sep = theme.fg("dim", ` ${SEP} `);
			const join = (xs: (string | undefined)[]) => xs.filter(Boolean).join(sep);

			return {
				dispose: unsub,
				invalidate() {},
				render(width: number): string[] {
					let input = 0, output = 0, cost = 0;
					for (const e of ctx.sessionManager.getBranch()) {
						if (e.type === "message" && e.message.role === "assistant") {
							const m = e.message as AssistantMessage;
							input += m.usage.input;
							output += m.usage.output;
							cost += m.usage.cost.total;
						}
					}
					const level = pi.getThinkingLevel();
					const model = ctx.model?.id ?? "no-model";
					const branch = footerData.getGitBranch();
					const usage = ctx.getContextUsage();
					const pct = usage?.percent;
					const pctColor = pct == null ? "dim" : pct > 85 ? "error" : pct > 60 ? "warning" : "success";
					const statuses = [...footerData.getExtensionStatuses().values()];
					const name = ctx.sessionManager.getSessionName();

					const left = join([
						theme.fg("accent", `${ICON.model} ${model}`) + (level && level !== "off" ? theme.fg("dim", ` (${level})`) : ""),
						theme.fg("text", `${ICON.dir} ${shortPath(ctx.cwd)}`),
						branch ? theme.fg("success", `${ICON.branch} ${branch}`) : undefined,
						...statuses,
					]);
					const right = join([
						name ? theme.fg("accent", name) : undefined,
						input + output > 0 ? theme.fg("dim", `${ICON.tok} ↑${fmt(input)} ↓${fmt(output)}`) : undefined,
						cost > 0 ? theme.fg("dim", `${ICON.cost} ${cost.toFixed(2)}`) : undefined,
						pct != null ? theme.fg(pctColor, `${ICON.ctx} ${pct.toFixed(0)}%`) : undefined,
					]);

					const room = width - visibleWidth(right) - 1;
					const l = truncateToWidth(left, Math.max(0, room), "…");
					const pad = " ".repeat(Math.max(1, width - visibleWidth(l) - visibleWidth(right)));
					return [truncateToWidth(l + pad + right, width)];
				},
			};
		});
	};

	pi.on("session_start", (_e, ctx) => {
		if (enabled) install(ctx);
	});

	pi.registerCommand("powerline", {
		description: "Toggle the powerline footer",
		handler: async (_args, ctx) => {
			enabled = !enabled;
			if (enabled) install(ctx);
			else ctx.ui.setFooter(undefined);
			ctx.ui.notify(`Powerline footer ${enabled ? "on" : "off"}`, "info");
		},
	});
}
