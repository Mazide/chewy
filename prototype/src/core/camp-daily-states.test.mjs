import test from 'node:test';
import assert from 'node:assert/strict';
import { createCapture, prepareCaptureReply, applyCaptureReply, captureDay, validateCaptureJobs, deleteCapture } from './capture-session.js';
import { dailyCampStages } from './camp-daily-states.js';

const empty = { protein: 0, carbs: 0, fats: 0, plants: 0 };
const now = new Date(2026, 10, 6, 12).getTime();
const capture = id => ({ ...createCapture({ source:'camera', theme:'science', portion:1, notes:'', delay:20000, outcome:'random', photos:[{id:'cover',imageKey:'meal',source:'camera'}] },now), id });

test('saved mock analyses drive three camp states without rerolls, duplicate contributions or next-day leakage', () => {
  const variants = new Set();
  for(let run=0;run<30;run++) {
    let jobs=[], previous=empty;
    for(let index=0;index<3;index++) {
      const job=capture(`camp-${run}-${index}`);
      jobs.push(job);
      assert.deepEqual(dailyCampStages(captureDay(jobs,now).meals),previous,'pending analysis contributes nothing');
      const reply=prepareCaptureReply(job);
      assert.deepEqual(prepareCaptureReply(job),reply,'same submitted attempt has one answer');
      jobs=applyCaptureReply(jobs,reply);
      validateCaptureJobs(jobs);
      assert.strictEqual(applyCaptureReply(jobs,reply),jobs,'late duplicate is ignored');
      const stages=dailyCampStages(captureDay(jobs,now).meals);
      for(const metric of Object.keys(empty)) assert.ok(stages[metric]>=previous[metric]);
      if(index===0) { assert.ok(Object.values(stages).includes(0)); assert.ok(Object.values(stages).includes(1)); }
      previous=stages;
      variants.add(JSON.stringify(reply.result.assessment.supplies));
    }
    assert.ok(Object.values(previous).includes(2),'three meals visibly reach the full sample');
    const restored=JSON.parse(JSON.stringify(jobs));
    assert.deepEqual(dailyCampStages(captureDay(restored,now).meals),previous);
    assert.deepEqual(dailyCampStages(captureDay(restored,now+86400000).meals),empty);
    let deleted=restored; for(const job of restored) deleted=deleteCapture(deleted,job.id);
    assert.deepEqual(dailyCampStages(captureDay(deleted,now).meals),empty);
    assert.deepEqual(dailyCampStages(captureDay(restored,now).meals),previous,'history is unchanged');
  }
  assert.ok(variants.size>20,'separate entries get varied compositions');
});
