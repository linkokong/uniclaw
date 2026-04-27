#!/usr/bin/env node
/**
 * UNICLAW MCP Server CLI Entry Point
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import and run the server
import('./index.js');
