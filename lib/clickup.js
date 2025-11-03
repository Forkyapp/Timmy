const axios = require('axios');
const config = require('./config');
const { jarvis, colors } = require('./ui');

async function getAssignedTasks() {
  try {
    const response = await axios.get(
      `https://api.clickup.com/api/v2/team/${config.clickup.workspaceId}/task`,
      {
        headers: {
          'Authorization': config.clickup.apiKey,
          'Content-Type': 'application/json'
        },
        params: {
          assignees: [config.clickup.botUserId],
          subtasks: false,
          order_by: 'updated',
          reverse: true
        }
      }
    );

    const allTasks = response.data.tasks || [];
    const filteredTasks = allTasks.filter(task => task.status?.status === 'bot in progress');
    return filteredTasks;
  } catch (error) {
    console.log(jarvis.error(`Failed to fetch tasks: ${error.message}`));
    return [];
  }
}

async function updateStatus(taskId, statusId) {
  try {
    await axios.put(
      `https://api.clickup.com/api/v2/task/${taskId}`,
      { status: statusId },
      {
        headers: {
          'Authorization': config.clickup.apiKey,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.log(jarvis.error(`Status update failed: ${error.message}`));
  }
}

async function addComment(taskId, commentText) {
  try {
    await axios.post(
      `https://api.clickup.com/api/v2/task/${taskId}/comment`,
      { comment_text: commentText },
      {
        headers: {
          'Authorization': config.clickup.apiKey,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.log(jarvis.error(`Comment failed: ${error.message}`));
  }
}

module.exports = {
  getAssignedTasks,
  updateStatus,
  addComment,
};
