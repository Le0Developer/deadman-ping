export interface Env {
	DB: D1Database;
	INSTATUS_API_KEY: string;
}

// we send a ping every 15s
const PING_INTERVAL = 15_000;

export default {
	async fetch(request: Request, env: Env) {
		const service = new URL(request.url).pathname.slice(1);
		const now = new Date().getTime();
		await env.DB.prepare("UPDATE LastPing SET lastPing = ? WHERE service = ?")
			.bind(now, service)
			.run();
		return new Response(null, { status: 204 });
	},
	async scheduled(
		event: ScheduledEvent,
		env: Env,
		ctx: ExecutionContext,
	): Promise<void> {
		const now = new Date().getTime();
		const services = await env.DB.prepare(
			"SELECT * FROM LastPing",
		).run<Service>();
		console.log(JSON.stringify(services));
		const updates: Array<D1PreparedStatement> = [];
		for (const {
			service,
			pageId,
			componentId,
			lastPing,
			incidentId,
		} of services.results) {
			const isDown = now - lastPing > 2 * PING_INTERVAL;

			if (isDown === !!incidentId) continue;

			if (isDown) {
				const incidentId = await declareIncident(env, pageId, componentId);
				updates.push(
					env.DB.prepare(
						"UPDATE LastPing SET incidentId = ? WHERE service = ?",
					).bind(incidentId, service),
				);
			} else {
				await resolveIncident(env, pageId, componentId, incidentId);
				updates.push(
					env.DB.prepare(
						"UPDATE LastPing SET incidentId = ? WHERE service = ?",
					).bind("", service),
				);
			}
		}
		if (updates.length) await env.DB.batch(updates);
	},
};

async function declareIncident(
	env: Env,
	pageId: string,
	componentId: string,
): Promise<string> {
	const response = await fetch(
		`https://api.instatus.com/v1/${pageId}/incidents`,
		{
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${env.INSTATUS_API_KEY}`,
			},
			body: JSON.stringify({
				name: "Service stopped responding",
				message:
					"Our automated probes stopped being received from the service.",
				components: [componentId],
				started: new Date().toISOString(),
				status: "MONITORING",
				notify: true,
				statuses: [
					{
						id: componentId,
						status: "MAJOROUTAGE",
					},
				],
			}),
		},
	);
	const body = await response.json<{ id: string }>();
	console.log(body);
	return body.id;
}

async function resolveIncident(
	env: Env,
	pageId: string,
	componentId: string,
	incidentId: string,
): Promise<void> {
	const response = await fetch(
		`https://api.instatus.com/v1/${pageId}/incidents/${incidentId}/incident-updates`,
		{
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${env.INSTATUS_API_KEY}`,
			},
			body: JSON.stringify({
				message: "Service appears to be back.",
				components: [componentId],
				started: new Date().toISOString(),
				status: "RESOLVED",
				notify: true,
				statuses: [
					{
						id: componentId,
						status: "OPERATIONAL",
					},
				],
			}),
		},
	);
	const body = await response.json();
	console.log(body);
}

interface Service {
	service: string;
	pageId: string;
	componentId: string;
	incidentId: string;
	lastPing: number;
}
