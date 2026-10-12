import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as W from '../labs/workflow/workflow-engine.mjs';
console.log('Running Workflow Lab v2 engine tests (variables, loops, debugging, templates, import/export)...');
assert.equal(fs.readFileSync(new URL('../labs/workflow/workflow-engine.js', import.meta.url), 'utf8'), fs.readFileSync(new URL('../labs/workflow/workflow-engine.mjs', import.meta.url), 'utf8'));
// expressions
const ctx = { a: 4, b: '2.5', s: 'x' };
assert.equal(W.evaluateExpression('1 + 2 * 3', ctx).value, 7); assert.equal(W.evaluateExpression('(1+2)*3', ctx).value, 9); assert.equal(W.evaluateExpression('a * b - -1', ctx).value, 11); assert.equal(W.evaluateExpression('10 % 4 / 2', ctx).value, 1);
for (const bad of ['', '1 +', '2 / 0', 's + 1', 'unknownVar', '1 2', 'alert(1)', '(1+2', '1 ; 2', 'a.b.c']) assert.equal(W.evaluateExpression(bad, ctx).ok, false, 'rejects: ' + bad);
assert.equal(W.evaluateExpression('process', {}).ok, false); assert.equal(W.evaluateExpression('constructor', {}).ok, false, 'prototype names are not variables');
assert.equal(W.interpolate('Hi {{ name }}, {{missing}}!', { name: 'Sam' }), 'Hi Sam, !');
// all templates and samples validate and finish
for (const wf of [...Object.values(W.SAMPLE_WORKFLOWS), ...Object.values(W.TEMPLATES)]) { const v = W.validateWorkflow(wf); assert.ok(v.valid, wf.name + ': ' + v.errors.join('; ')); const r = new W.WorkflowSimulator(wf, wf.initialPayload).runAll(); assert.equal(r.logs.at(-1).type, 'end', wf.name + ' ends cleanly'); }
// loop template result
{ const t = W.TEMPLATES.loopCounter, r = new W.WorkflowSimulator(t, t.initialPayload).runAll(); assert.equal(r.context.total, 10); assert.equal(r.logs.filter(l => l.type === 'loop').length, 5); }
{ const t = W.TEMPLATES.retry; let r = new W.WorkflowSimulator(t, t.initialPayload).runAll(); assert.equal(r.context.status, 'done after 2 attempt(s)'); r = new W.WorkflowSimulator(t, { ...t.initialPayload, succeedOnAttempt: 9 }).runAll(); assert.equal(r.context.status, 'failed after 3 attempts'); }
{ const t = W.TEMPLATES.approval; assert.equal(new W.WorkflowSimulator(t, t.initialPayload).runAll().logs.at(-1).nodeLabel, 'Waiting for manager'); assert.equal(new W.WorkflowSimulator(t, { ...t.initialPayload, amount: 100 }).runAll().logs.at(-1).nodeLabel, 'Approved'); }
// loop safety: huge count is capped; infinite structure halted by step limit
{ const t = W.cloneWorkflow(W.TEMPLATES.loopCounter); t.nodes[1].config.count = 9999; const sim = new W.WorkflowSimulator(t, { total: 0, i: 0 }); sim.maxSteps = 1000; const r = sim.runAll(); assert.equal(r.logs.filter(l => l.type === 'loop').length, W.MAX_LOOP_ITERATIONS + 1); assert.ok(r.logs.some(l => /capped at/.test(l.message))); }
{ const inf = { nodes: [{ id: 's', type: 'start' }, { id: 'a', type: 'action', config: { actionType: 'notify_log' } }, { id: 'e', type: 'end' }], edges: [{ from: 's', to: 'a' }, { from: 'a', to: 'a' }, { from: 'a', to: 'e' }] }; const r = new W.WorkflowSimulator(inf).runAll(); assert.ok(r.logs.some(l => /exceeded maximum step/.test(l.message))); }
// validation of loop edges
{ const t = W.cloneWorkflow(W.TEMPLATES.loopCounter); t.edges = t.edges.filter(e => e.branch !== 'done'); const v = W.validateWorkflow(t); assert.equal(v.valid, false); assert.ok(v.errors.some(e => /Done/.test(e))); }
// debugger: step back and breakpoints
{ const t = W.TEMPLATES.loopCounter, sim = new W.WorkflowSimulator(t, t.initialPayload); sim.step(); sim.step(); sim.step(); const before = sim.context.i; assert.equal(sim.stepBack(), true); assert.equal(sim.logs.length, 2); sim.step(); assert.equal(sim.context.i, before, 'replay is deterministic'); while (sim.stepBack()); assert.equal(sim.stepBack(), false); assert.equal(sim.currentNodeId, 't_start'); assert.equal(sim.logs.length, 0);
  const b = new W.WorkflowSimulator(t, t.initialPayload); b.breakpoints.add('t_add'); let r = b.runToBreakpoint(); assert.equal(r.paused, true); assert.equal(r.nodeId, 't_add'); r = b.runToBreakpoint(); assert.equal(r.paused, true); assert.equal(b.context.total, 1); b.breakpoints.clear(); assert.equal(b.runToBreakpoint().done, true); assert.equal(b.context.total, 10); }
// import / export
{ const t = W.TEMPLATES.retry, json = W.exportWorkflow(t), back = W.parseWorkflowJson(json); assert.equal(JSON.parse(json).format, 'govibetool-workflow'); assert.deepEqual(back.nodes, t.nodes); assert.equal(back.initialPayload.succeedOnAttempt, 2); assert.throws(() => W.parseWorkflowJson('{"nodes":1}')); assert.throws(() => W.parseWorkflowJson('{bad')); }
// existing behaviours unchanged
assert.equal(W.evaluateCondition({ field: 'n', operator: 'greater_than', value: '5' }, { n: 7 }), true);
console.log('✓ Workflow v2 engine: expressions, loops with caps, breakpoints/step-back, templates, import/export');
