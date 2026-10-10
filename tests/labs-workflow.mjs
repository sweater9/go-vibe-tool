import assert from 'node:assert';
import {
  NODE_TYPES,
  ACTION_OPERATIONS,
  CONDITION_OPERATORS,
  validateWorkflow,
  evaluateCondition,
  executeAction,
  WorkflowSimulator,
  parseWorkflowJson,
  SAMPLE_WORKFLOWS
} from '../labs/workflow/workflow-engine.mjs';

console.log('Running Visual Workflow Lab automated tests...');

// 1. Structural Validation on Built-in Samples
for (const [key, sample] of Object.entries(SAMPLE_WORKFLOWS)) {
  const res = validateWorkflow(sample);
  assert.strictEqual(res.valid, true, `Sample "${key}" should be valid. Errors: ${res.errors.join(', ')}`);
  assert.strictEqual(res.errors.length, 0, `Sample "${key}" should have 0 validation errors`);
}
console.log('✓ All 3 sample workflows passed structural validation');

// 2. Detection of Invalid Workflows
{
  // Missing Start Node
  const noStart = {
    nodes: [{ id: 'n1', type: NODE_TYPES.END, label: 'End' }],
    edges: []
  };
  const res = validateWorkflow(noStart);
  assert.strictEqual(res.valid, false);
  assert.ok(res.errors.some(e => e.includes('missing a Start node')));
}

{
  // Multiple Start Nodes
  const multiStart = {
    nodes: [
      { id: 's1', type: NODE_TYPES.START, label: 'Start 1' },
      { id: 's2', type: NODE_TYPES.START, label: 'Start 2' },
      { id: 'e1', type: NODE_TYPES.END, label: 'End' }
    ],
    edges: [
      { id: 'e1', from: 's1', to: 'e1', branch: 'default' },
      { id: 'e2', from: 's2', to: 'e1', branch: 'default' }
    ]
  };
  const res = validateWorkflow(multiStart);
  assert.strictEqual(res.valid, false);
  assert.ok(res.errors.some(e => e.includes('Only one Start trigger is supported')));
}

{
  // Condition missing True or False branch
  const incompleteCond = {
    nodes: [
      { id: 's1', type: NODE_TYPES.START, label: 'Start' },
      { id: 'c1', type: NODE_TYPES.CONDITION, label: 'Check' },
      { id: 'e1', type: NODE_TYPES.END, label: 'End' }
    ],
    edges: [
      { id: 'e1', from: 's1', to: 'c1', branch: 'default' },
      { id: 'e2', from: 'c1', to: 'e1', branch: 'true' } // Missing 'false' branch
    ]
  };
  const res = validateWorkflow(incompleteCond);
  assert.strictEqual(res.valid, false);
  assert.ok(res.errors.some(e => e.includes('missing a "False" branch')));
}

{
  // Disconnected Action Node
  const disconnected = {
    nodes: [
      { id: 's1', type: NODE_TYPES.START, label: 'Start' },
      { id: 'a1', type: NODE_TYPES.ACTION, label: 'Orphan Action' },
      { id: 'e1', type: NODE_TYPES.END, label: 'End' }
    ],
    edges: [
      { id: 'e1', from: 's1', to: 'e1', branch: 'default' }
    ]
  };
  const res = validateWorkflow(disconnected);
  assert.strictEqual(res.valid, false);
  assert.ok(res.errors.some(e => e.includes('is disconnected')));
}
console.log('✓ Invalid workflow structures accurately detected');

// 3. Deterministic Condition Evaluation
{
  assert.strictEqual(evaluateCondition({ field: 'tier', operator: CONDITION_OPERATORS.EQUALS, value: 'vip' }, { tier: 'vip' }), true);
  assert.strictEqual(evaluateCondition({ field: 'tier', operator: CONDITION_OPERATORS.EQUALS, value: 'vip' }, { tier: 'standard' }), false);

  assert.strictEqual(evaluateCondition({ field: 'score', operator: CONDITION_OPERATORS.GREATER_THAN, value: '50' }, { score: 75 }), true);
  assert.strictEqual(evaluateCondition({ field: 'score', operator: CONDITION_OPERATORS.GREATER_THAN, value: '50' }, { score: 25 }), false);

  assert.strictEqual(evaluateCondition({ field: 'score', operator: CONDITION_OPERATORS.LESS_THAN, value: '10' }, { score: 5 }), true);

  assert.strictEqual(evaluateCondition({ field: 'email', operator: CONDITION_OPERATORS.CONTAINS, value: '@company.com' }, { email: 'ceo@company.com' }), true);
  assert.strictEqual(evaluateCondition({ field: 'email', operator: CONDITION_OPERATORS.CONTAINS, value: '@company.com' }, { email: 'hacker@gmail.com' }), false);

  assert.strictEqual(evaluateCondition({ field: 'phone', operator: CONDITION_OPERATORS.IS_EMPTY }, { phone: '' }), true);
  assert.strictEqual(evaluateCondition({ field: 'phone', operator: CONDITION_OPERATORS.IS_EMPTY }, { phone: '123' }), false);
}
console.log('✓ Deterministic condition rules evaluated correctly');

// 4. Action Operations & Context Transformations
{
  const nodeSet = { label: 'Set Var', config: { actionType: ACTION_OPERATIONS.SET_VARIABLE, paramKey: 'status', paramValue: 'approved' } };
  const resSet = executeAction(nodeSet, {});
  assert.strictEqual(resSet.newContext.status, 'approved');

  const nodeTransform = { label: 'Upper', config: { actionType: ACTION_OPERATIONS.TRANSFORM_TEXT, paramKey: 'name', transformMode: 'uppercase' } };
  const resTrans = executeAction(nodeTransform, { name: 'alice' });
  assert.strictEqual(resTrans.newContext.name, 'ALICE');

  const nodeScore = { label: 'Add', config: { actionType: ACTION_OPERATIONS.CALCULATE_SCORE, paramKey: 'score', paramValue: 25 } };
  const resScore = executeAction(nodeScore, { score: 10 });
  assert.strictEqual(resScore.newContext.score, 35);

  const nodeSanitize = { label: 'Clean', config: { actionType: ACTION_OPERATIONS.SANITIZE_DATA, paramKey: 'email' } };
  const resSanitize = executeAction(nodeSanitize, { email: '  john.doe+test@domain.com <script> ' });
  assert.strictEqual(resSanitize.newContext.email, 'john.doe+test@domain.com');
}
console.log('✓ Action operations transformed state accurately');

// 5. Full Simulation Stepper & Execution Paths
{
  // Test Enterprise branch of Customer Support
  const sim1 = new WorkflowSimulator(SAMPLE_WORKFLOWS.customerSupport, { customerTier: 'enterprise' });
  const result1 = sim1.runAll();
  assert.strictEqual(result1.done, true);
  assert.strictEqual(result1.context.priorityScore, 100, 'Enterprise tier should receive 100 priority score');
  assert.ok(result1.logs.some(l => l.message && l.message.includes('Page On-Call Tier 3')));

  // Test Standard branch of Customer Support
  const sim2 = new WorkflowSimulator(SAMPLE_WORKFLOWS.customerSupport, { customerTier: 'standard' });
  const result2 = sim2.runAll();
  assert.strictEqual(result2.done, true);
  assert.strictEqual(result2.context.priorityScore, 20, 'Standard tier should receive 20 priority score');
  assert.ok(result2.logs.some(l => l.message && l.message.includes('Queue in General Support')));
}
console.log('✓ End-to-end simulation paths execute deterministically');

// 6. JSON Import / Export & Malformed / Oversized Rejection
{
  // Valid JSON parse
  const serialized = JSON.stringify(SAMPLE_WORKFLOWS.leadQualification);
  const parsed = parseWorkflowJson(serialized);
  assert.strictEqual(parsed.id, SAMPLE_WORKFLOWS.leadQualification.id);

  // Malformed JSON syntax
  assert.throws(() => parseWorkflowJson('{ invalid json: true '), /Malformed JSON/);

  // Missing nodes/edges
  assert.throws(() => parseWorkflowJson('{"foo": "bar"}'), /missing required "nodes" or "edges"/);

  // Oversized payload rejection (> 500 KB)
  const hugePayload = JSON.stringify({
    nodes: [],
    edges: [],
    padding: 'X'.repeat(501000)
  });
  assert.throws(() => parseWorkflowJson(hugePayload), /Oversized input/);
}
console.log('✓ Workflow JSON serialization, validation, and DoS rejection verified');

console.log('ALL Visual Workflow Lab tests passed successfully!\n');
