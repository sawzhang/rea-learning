import assert from 'node:assert/strict';

// This accepts complete selected-function captures, not arbitrary V8 payloads.
export function mergeCoverage(captures) {
  assert.ok(captures.length > 0, 'At least one capture is required');
  assert.equal(new Set(captures.map(c => c.capture_id)).size, captures.length, 'Duplicate capture ID');
  const first = captures[0];
  const keys = first.items.map(item => item.static_node_id).sort();
  for (const capture of captures) {
    assert.equal(capture.source_sha256, first.source_sha256, 'Source digest mismatch');
    assert.equal(capture.node_version, first.node_version, 'Node version mismatch');
    assert.equal(capture.offset_units, 'utf16-code-units');
    assert.deepEqual(capture.items.map(item => item.static_node_id).sort(), keys, 'Incomplete function inventory');
  }
  return keys.map(id => {
    const functions = captures.map(c => c.items.find(item => item.static_node_id === id));
    const outer = functions[0].ranges[0];
    for (const fn of functions) {
      assert.equal(fn.ranges[0].startOffset, outer.startOffset, 'Function boundary mismatch');
      assert.equal(fn.ranges[0].endOffset, outer.endOffset, 'Function boundary mismatch');
      const seen = new Set();
      for (const range of fn.ranges) {
        assert.ok(Number.isSafeInteger(range.count) && range.count >= 0);
        assert.ok(Number.isSafeInteger(range.startOffset) && Number.isSafeInteger(range.endOffset));
        assert.ok(range.startOffset >= outer.startOffset && range.endOffset <= outer.endOffset && range.startOffset < range.endOffset);
        const key = `${range.startOffset}:${range.endOffset}`;
        assert.ok(!seen.has(key), 'Duplicate range'); seen.add(key);
      }
      for (const a of fn.ranges) for (const b of fn.ranges) {
        const overlap = a.startOffset < b.endOffset && b.startOffset < a.endOffset;
        assert.ok(!overlap || (a.startOffset <= b.startOffset && a.endOffset >= b.endOffset) || (b.startOffset <= a.startOffset && b.endOffset >= a.endOffset), 'Crossing ranges');
      }
    }
    const boundaries = [...new Set(functions.flatMap(fn => fn.ranges.flatMap(r => [r.startOffset, r.endOffset])))].sort((a,b) => a-b);
    const segments = boundaries.slice(0,-1).map((startOffset,index) => {
      const endOffset = boundaries[index+1];
      const counts = functions.map(fn => {
        const containing = fn.ranges.filter(r => r.startOffset <= startOffset && r.endOffset >= endOffset);
        containing.sort((a,b) => (a.endOffset-a.startOffset)-(b.endOffset-b.startOffset));
        assert.ok(containing.length, 'Uncovered source interval is unknown, not zero');
        return containing[0].count;
      });
      const count = counts.reduce((sum,n) => sum+n,0);
      assert.ok(Number.isSafeInteger(count), 'Count overflow');
      return { startOffset, endOffset, count };
    });
    const invocation_count = functions.reduce((sum,fn) => sum+fn.ranges[0].count,0);
    assert.ok(Number.isSafeInteger(invocation_count));
    return { static_node_id: id, name: functions[0].name, invocation_count, segments };
  });
}
