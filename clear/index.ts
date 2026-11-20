/**
 * /clear — alias for /new that keeps the current model and thinking level.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	pi.registerCommand("clear", {
		description: "Start a new session (like /new), keeping model and thinking level",
		handler: async (_args, ctx) => {
			const model = ctx.model;
			const level = pi.getThinkingLevel();
			const result = await ctx.newSession({
				parentSession: ctx.sessionManager.getSessionFile(),
				withSession: async () => {
					if (model) await pi.setModel(model);
					pi.setThinkingLevel(level);
				},
			});
			if (result.cancelled) ctx.ui.notify("/clear cancelled", "warning");
		},
	});
}
