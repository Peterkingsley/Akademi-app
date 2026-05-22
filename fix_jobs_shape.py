import os

file_path = 'akademi-backend/src/modules/admin/admin.service.ts'
with open(file_path, 'r') as f:
    content = f.read()

old_jobs_map = """    return allJobs.map(job => ({
      id: job.id,
      name: job.name,
      data: job.data,
      status: (job as any).status || 'unknown',
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      timestamp: job.timestamp,
      failedReason: job.failedReason,
    })).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 50);"""

new_jobs_map = """    return allJobs.map(job => {
      const duration = job.finishedOn && job.processedOn
        ? ((job.finishedOn - job.processedOn) / 1000).toFixed(1) + 's'
        : 'N/A';

      return {
        id: job.id,
        name: job.name,
        lastRun: new Date(job.timestamp),
        status: (job as any)._progress === 100 || job.finishedOn ? 'success' : (job.failedReason ? 'failed' : 'active'),
        duration
      };
    }).sort((a, b) => (b.lastRun.getTime() || 0) - (a.lastRun.getTime() || 0)).slice(0, 50);"""

if old_jobs_map in content:
    content = content.replace(old_jobs_map, new_jobs_map)

with open(file_path, 'w') as f:
    f.write(content)
