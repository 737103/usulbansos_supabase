const { Server } = require('@modelcontextprotocol/sdk');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } }) : null;

const server = new Server({ name: 'mcp-supabase-tools', version: '1.0.0' });

if (!supabase) {
	console.warn('Supabase belum terkonfigurasi. Set SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY/ANON_KEY.');
}

server.tool('supabase.select', {
	description: 'Query SELECT generik dari tabel Supabase',
	inputSchema: {
		type: 'object',
		properties: {
			table: { type: 'string' },
			columns: { type: 'array', items: { type: 'string' }, default: ['*'] },
			match: { type: 'object', additionalProperties: true }
		},
		required: ['table']
	},
	async execute({ table, columns = ['*'], match }) {
		if (!supabase) throw new Error('Supabase tidak siap');
		let query = supabase.from(table).select(columns.join(','));
		if (match && typeof match === 'object') {
			Object.entries(match).forEach(([k, v]) => {
				query = query.eq(k, v);
			});
		}
		const { data, error } = await query;
		if (error) throw error;
		return { data };
	}
});

server.tool('supabase.insert', {
	description: 'INSERT generik ke tabel Supabase',
	inputSchema: {
		type: 'object',
		properties: {
			table: { type: 'string' },
			values: { type: 'object', additionalProperties: true }
		},
		required: ['table', 'values']
	},
	async execute({ table, values }) {
		if (!supabase) throw new Error('Supabase tidak siap');
		const { data, error } = await supabase.from(table).insert(values).select();
		if (error) throw error;
		return { data };
	}
});

server.tool('supabase.update', {
	description: 'UPDATE generik di tabel Supabase',
	inputSchema: {
		type: 'object',
		properties: {
			table: { type: 'string' },
			match: { type: 'object', additionalProperties: true },
			values: { type: 'object', additionalProperties: true }
		},
		required: ['table', 'match', 'values']
	},
	async execute({ table, match, values }) {
		if (!supabase) throw new Error('Supabase tidak siap');
		let query = supabase.from(table).update(values);
		Object.entries(match).forEach(([k, v]) => {
			query = query.eq(k, v);
		});
		const { data, error } = await query.select();
		if (error) throw error;
		return { data };
	}
});

server.tool('supabase.storageCreateSignedUrl', {
	description: 'Buat signed URL untuk upload/download ke bucket Storage',
	inputSchema: {
		type: 'object',
		properties: {
			bucket: { type: 'string' },
			path: { type: 'string' },
			expirySeconds: { type: 'number', default: 3600 }
		},
		required: ['bucket', 'path']
	},
	async execute({ bucket, path, expirySeconds = 3600 }) {
		if (!supabase) throw new Error('Supabase tidak siap');
		const { data, error } = await supabase
			.storage
			.from(bucket)
			.createSignedUploadUrl(path, { upsert: true, expiresIn: expirySeconds });
		if (error) throw error;
		return { data };
	}
});

const port = process.env.MCP_PORT ? Number(process.env.MCP_PORT) : 7331;
server.listen({ port }).then(() => {
	console.log(`MCP server berjalan di port ${port}`);
}).catch((err) => {
	console.error('Gagal menjalankan MCP server:', err);
	process.exit(1);
});
