/**
 * omp-style footer (Nerd Font required): one row, left-aligned segments
 * separated by dim "·":  ⌲ · ◕ model · 📂 path · branch · ctx%/window · statuses
 * /powerline toggles it. Enabled by default.
 */
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import { homedir } from "node:os";

const ICON = {
	brand: "\uEB6D",
	model: "\uF0E7",
	dir: "\uF07C",
	branch: "\uE0A0",
	ctx: "\uF2DB",
	think: "\uF0D0",
};

const win = (n: number) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`);

function shortPath(cwd: string, max = 40): string {
	const home = homedir();
	const p = cwd.startsWith(home) ? "~" + cwd.slice(home.length) : cwd;
	if (p.length <= max) return p;
	return "…/" + p.split("/").slice(-2).join("/");
}

// "claude-sonnet-5-5" -> "Sonnet 5.5"
function prettyModel(id: string, name?: string): string {
	if (name) return name.replace(/^Claude\s+/i, "");
	const m = id.replace(/^claude-/, "").match(/^([a-z]+)-(\d+)(?:-(\d+))?/);
	if (!m) return id;
	return `${m[1][0].toUpperCase()}${m[1].slice(1)} ${m[2]}${m[3] ? "." + m[3] : ""}`;
}

export default function (pi: ExtensionAPI) {
	let enabled = true;

	const install = (ctx: ExtensionContext) => {
		if (!ctx.hasUI) return;
		ctx.ui.setFooter((tui, theme, footerData) => {
			const unsub = footerData.onBranchChange(() => tui.requestRender());
			const sep = theme.fg("dim", " · ");

			return {
				dispose: unsub,
				invalidate() {},
				render(width: number): string[] {
					const level = pi.getThinkingLevel();
					const model = ctx.model;
					const branch = footerData.getGitBranch();
					const usage = ctx.getContextUsage();
					const pct = usage?.percent;
					const pctColor = pct == null ? "dim" : pct > 85 ? "error" : pct > 60 ? "warning" : "dim";

					const segs: (string | undefined)[] = [
						theme.fg("dim", ICON.brand),
						model
							? theme.fg("customMessageLabel", `${ICON.model} ${prettyModel(model.id, (model as any).name)}`) +
								(level && level !== "off" ? theme.fg("dim", ` ${level}`) : "")
							: theme.fg("dim", "no-model"),
						theme.fg("mdLink", `${ICON.dir} ${shortPath(ctx.cwd)}`),
						branch ? theme.fg("success", `${ICON.branch} ${branch}`) : undefined,
						usage
							? theme.fg(pctColor, `${ICON.ctx} ${pct == null ? "?" : pct.toFixed(1)}%/${win(usage.contextWindow)}`)
							: undefined,
						...footerData.getExtensionStatuses().values(),
					];
					return [truncateToWidth(segs.filter(Boolean).join(sep), width, "…")];
				},
			};
		});
	};

	pi.on("session_start", (_e, ctx) => {
		if (enabled) install(ctx);
	});

	pi.registerCommand("powerline", {
		description: "Toggle the omp-style footer",
		handler: async (_args, ctx) => {
			enabled = !enabled;
			if (enabled) install(ctx);
			else ctx.ui.setFooter(undefined);
			ctx.ui.notify(`Footer ${enabled ? "on" : "off"}`, "info");
		},
	});
}
