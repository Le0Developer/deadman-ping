CREATE TABLE IF NOT EXISTS LastPing (
	service TEXT NOT NULL,
	pageId TEXT NOT NULL,
	componentId TEXT NOT NULL,
	incidentId TEXT,
	lastPing INTEGER DEFAULT 0
);
