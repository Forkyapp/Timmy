const fs = require('fs');
const config = require('./config');

let processedTasksData = [];
let processedTaskIds = new Set();

function loadProcessedTasks() {
  try {
    if (fs.existsSync(config.files.cacheFile)) {
      const data = JSON.parse(fs.readFileSync(config.files.cacheFile, 'utf8'));
      if (data.length > 0 && typeof data[0] === 'string') {
        return data.map(id => ({ id, title: 'Unknown', description: '', detectedAt: new Date().toISOString() }));
      }
      return data;
    }
  } catch (error) {
    console.error('Error loading cache:', error.message);
  }
  return [];
}

function saveProcessedTasks() {
  try {
    fs.writeFileSync(config.files.cacheFile, JSON.stringify(processedTasksData, null, 2));
  } catch (error) {
    console.error('Error saving cache:', error.message);
  }
}

function addToProcessed(task) {
  if (!processedTaskIds.has(task.id)) {
    processedTasksData.push({
      id: task.id,
      title: task.name,
      description: task.description || task.text_content || '',
      detectedAt: new Date().toISOString()
    });
    processedTaskIds.add(task.id);
    saveProcessedTasks();
  }
}

function initializeCache() {
  processedTasksData = loadProcessedTasks();
  processedTaskIds = new Set(processedTasksData.map(t => t.id));
}

module.exports = {
  loadProcessedTasks,
  saveProcessedTasks,
  addToProcessed,
  initializeCache,
  get processedTasksData() { return processedTasksData; },
  set processedTasksData(val) { processedTasksData = val; },
  get processedTaskIds() { return processedTaskIds; },
  set processedTaskIds(val) { processedTaskIds = val; },
};
