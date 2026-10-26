/**
 * CareBridge 2.0 — Master Test Suite Isolation Runner
 * ===================================================
 * Configures process.env.NODE_ENV = 'test' BEFORE importing db.js or test_suite.js,
 * guaranteeing all test fixtures and assertions execute exclusively in carebridge.test.sqlite
 * without contaminating the operational carebridge.sqlite database.
 */

process.env.NODE_ENV = 'test';
import('./test_suite.js');
