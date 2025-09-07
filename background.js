// Chrome Extension背景服务脚本 - 简化版本
console.log('Background script started');

// 插件安装时
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed:', details);
  if (details.reason === 'install') {
    console.log('First time installation');
  }
});

// Chrome启动时
chrome.runtime.onStartup.addListener(async () => {
  console.log('Chrome startup detected');
  await openSnapshotPageIfAvailable();
});

// 键盘快捷键监听器
chrome.commands.onCommand.addListener(async (command) => {
  console.log('Command received:', command);
  
  try {
    switch (command) {
      case 'save-snapshot':
        console.log('Executing save-snapshot command');
        await saveCurrentSession();
        // 显示通知
        showNotification(chrome.i18n.getMessage('sessionSaved'), 'success');
        break;
        
      case 'restore-snapshot':
        console.log('Executing restore-snapshot command');
        await restoreSession();
        break;
        
      case 'save-and-close':
        console.log('Executing save-and-close command');
        await saveAndCloseCurrentWindow();
        break;
        
      case 'view-snapshot':
        console.log('Executing view-snapshot command');
        await openSnapshotPage();
        break;
        
      default:
        console.log('Unknown command:', command);
    }
  } catch (error) {
    console.error('Error executing command:', command, error);
    showNotification(chrome.i18n.getMessage('saveFailed') + ': ' + error.message, 'error');
  }
});

// 显示通知函数
function showNotification(message, type = 'info') {
  // 创建通知ID
  const notificationId = 'browser-assistant-' + Date.now();
  
  chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: chrome.i18n.getMessage('extensionName'),
    message: message
  }, (notificationId) => {
    if (chrome.runtime.lastError) {
      console.log('Notification failed:', chrome.runtime.lastError);
      return;
    }
    console.log('Notification created:', notificationId);
    
    // 3秒后自动清除通知
    setTimeout(() => {
      chrome.notifications.clear(notificationId);
    }, 3000);
  });
}

// 监听所有窗口关闭
let windowCloseTimer = null;

chrome.windows.onRemoved.addListener(async (windowId) => {
  console.log('Window closed:', windowId);
  
  // 清除之前的定时器
  if (windowCloseTimer) {
    clearTimeout(windowCloseTimer);
  }
  
  // 延迟检查是否所有窗口都关闭了
  windowCloseTimer = setTimeout(async () => {
    try {
      const windows = await chrome.windows.getAll();
      console.log('Remaining windows:', windows.length);
      
      if (windows.length === 0) {
        console.log('All windows closed - saving session');
        await saveCurrentSession();
      }
    } catch (error) {
      console.error('Error checking windows:', error);
    }
  }, 100);
});

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request);
  
  if (request.action === 'saveSession') {
    saveCurrentSession()
      .then(() => sendResponse({ success: true }))
      .catch(error => {
        console.error('Save session error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (request.action === 'openSnapshot') {
    openSnapshotPageIfAvailable()
      .then(() => sendResponse({ success: true }))
      .catch(error => {
        console.error('Open snapshot error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (request.action === 'restoreSnapshot') {
    restoreSnapshot(request.mode)
      .then((result) => sendResponse({ success: true, tabsCount: result.tabsCount }))
      .catch(error => {
        console.error('Restore snapshot error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (request.action === 'saveAndCloseAllTabs') {
    saveAndCloseAllTabs(request.windowId)
      .then(() => sendResponse({ success: true }))
      .catch(error => {
        console.error('Save and close all tabs error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (request.action === 'restoreGroup') {
    restoreGroupSnapshot(request.groupId, request.groupData)
      .then((result) => sendResponse({ 
        success: true, 
        tabsCount: result.tabsCount,
        skippedCount: result.skippedCount,
        message: result.message
      }))
      .catch(error => {
        console.error('Restore group snapshot error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (request.action === 'setHomepage') {
    setHomepage(request.url)
      .then((result) => sendResponse({ success: true, ...result }))
      .catch(error => {
        console.error('Set homepage error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (request.action === 'generateSnapshotHTML') {
    generateSnapshotHTML(request.sessionData)
      .then(html => sendResponse(html))
      .catch(error => {
        console.error('Generate snapshot HTML error:', error);
        sendResponse(null);
      });
    return true;
  }
  
  if (request.action === 'generateHistorySnapshot') {
    generateHistorySnapshot()
      .then((result) => sendResponse({ success: true, historySnapshotUrl: result.url }))
      .catch(error => {
        console.error('Generate history snapshot error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

// 生产环境日志控制
const DEBUG_MODE = false; // 生产环境设为false
const debugLog = DEBUG_MODE ? console.log : () => {};
const debugWarn = DEBUG_MODE ? console.warn : () => {};
const debugError = console.error; // 错误日志始终保留

// 云同步服务类
class CloudSyncService {
  constructor() {
    this.maxChunkSize = 7500; // Chrome sync单项限制8KB，留余量
    this.isEnabled = false;
    this.initialized = false;
    this.init();
  }
  
  async init() {
    try {
      // 检查用户是否登录Chrome账户
      const profile = await chrome.identity.getProfileUserInfo();
      this.isEnabled = !!profile.email;
      console.log('Cloud sync status:', this.isEnabled ? 'enabled' : 'disabled');
    } catch (error) {
      console.log('Cloud sync not available:', error);
      this.isEnabled = false;
    } finally {
      this.initialized = true;
    }
  }
  
  // 将数据分片存储
  splitDataIntoChunks(data) {
    const jsonString = JSON.stringify(data);
    const chunks = [];
    
    for (let i = 0; i < jsonString.length; i += this.maxChunkSize) {
      chunks.push(jsonString.slice(i, i + this.maxChunkSize));
    }
    
    return chunks;
  }
  
  // 重组分片数据
  async reassembleChunks(chunkCount) {
    const chunks = [];
    
    for (let i = 0; i < chunkCount; i++) {
      const result = await chrome.storage.sync.get(`snapshot_chunk_${i}`);
      const chunk = result[`snapshot_chunk_${i}`];
      if (!chunk) throw new Error(`Missing chunk ${i}`);
      chunks.push(chunk);
    }
    
    return JSON.parse(chunks.join(''));
  }
  
  // 保存到云端
  async saveToCloud(data) {
    if (!this.isEnabled) {
      throw new Error('Cloud sync not available. Please sign in to Chrome.');
    }
    
    try {
      const chunks = this.splitDataIntoChunks(data);
      const syncData = {};
      
      // 清除旧数据
      await this.clearCloudData();
      
      // 保存分片数据
      chunks.forEach((chunk, index) => {
        syncData[`snapshot_chunk_${index}`] = chunk;
      });
      
      // 保存元数据
      syncData['snapshot_meta'] = {
        timestamp: Date.now(),
        chunkCount: chunks.length,
        version: '1.2'
      };
      
      await chrome.storage.sync.set(syncData);
      console.log(`Successfully synced ${chunks.length} chunks to cloud`);
      
      return true;
    } catch (error) {
      console.error('Failed to sync to cloud:', error);
      throw error;
    }
  }
  
  // 从云端加载
  async loadFromCloud() {
    if (!this.isEnabled) {
      throw new Error('Cloud sync not available');
    }
    
    try {
      const metaResult = await chrome.storage.sync.get('snapshot_meta');
      const meta = metaResult.snapshot_meta;
      
      if (!meta) {
        throw new Error('No cloud backup found');
      }
      
      const data = await this.reassembleChunks(meta.chunkCount);
      console.log('Successfully loaded data from cloud, timestamp:', new Date(meta.timestamp));
      
      return data;
    } catch (error) {
      console.error('Failed to load from cloud:', error);
      throw error;
    }
  }
  
  // 清除云端数据
  async clearCloudData() {
    try {
      // 获取所有存储的键
      const allData = await chrome.storage.sync.get(null);
      const keysToRemove = Object.keys(allData).filter(key => 
        key.startsWith('snapshot_chunk_') || key === 'snapshot_meta'
      );
      
      if (keysToRemove.length > 0) {
        await chrome.storage.sync.remove(keysToRemove);
        console.log('Cleared old cloud data:', keysToRemove.length, 'items');
      }
    } catch (error) {
      console.error('Failed to clear cloud data:', error);
    }
  }
  
  // 检查云端是否有更新的数据
  async hasNewerCloudData() {
    try {
      const cloudMeta = await chrome.storage.sync.get('snapshot_meta');
      const localData = await chrome.storage.local.get('lastSession');
      
      if (!cloudMeta.snapshot_meta || !localData.lastSession) {
        return false;
      }
      
      return cloudMeta.snapshot_meta.timestamp > localData.lastSession.timestamp;
    } catch (error) {
      return false;
    }
  }
}

// 初始化云同步服务
const cloudSync = new CloudSyncService();

// 保存当前会话
async function saveCurrentSession() {
  console.log('Saving current session...');
  
  try {
    const windows = await chrome.windows.getAll({ populate: true });
    const sessionData = {
      timestamp: Date.now(),
      windows: []
    };

    // 获取标签页分组
    let tabGroups = {};
    try {
      const groups = await chrome.tabGroups.query({});
      groups.forEach(group => {
        tabGroups[group.id] = {
          title: group.title || chrome.i18n.getMessage('unnamedGroup'),
          color: group.color
        };
      });
    } catch (error) {
      console.log('Unable to get tab groups:', error);
    }

    // 处理每个窗口
    for (const window of windows) {
      const windowData = {
        id: window.id,
        tabs: []
      };

      for (const tab of window.tabs) {
        if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
          // 安全获取页面描述，使用优化的超时和错误处理
          let description;
          try {
            // 优化超时时间，提高性能
            const descriptionPromise = getPageDescription(tab);
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Description timeout')), 1500)
            );
            
            description = await Promise.race([descriptionPromise, timeoutPromise]);
            
            // 验证描述质量
            if (!description || description === 'No description' || description.length < 5) {
              description = chrome.i18n.getMessage('noDescription') || 'No description available';
            }
          } catch (error) {
            debugLog('Page description failed for tab:', tab.url, error.message);
            description = chrome.i18n.getMessage('noDescription') || 'No description available';
          }
          
          const tabData = {
            url: tab.url,
            title: tab.title,
            favIconUrl: tab.favIconUrl,
            groupId: tab.groupId,
            pinned: tab.pinned,
            description: description
          };
          windowData.tabs.push(tabData);
        }
      }
      
      if (windowData.tabs.length > 0) {
        sessionData.windows.push(windowData);
      }
    }

    sessionData.groups = tabGroups;

    // 安全生成快照HTML
    let snapshotHtml = null;
    try {
      snapshotHtml = await generateSnapshotHTML(sessionData);
    } catch (htmlError) {
      console.warn('Failed to generate snapshot HTML:', htmlError);
      snapshotHtml = '<html><body><h1>Snapshot HTML generation failed</h1></body></html>';
    }
    
    // 保存到本地存储
    await chrome.storage.local.set({ 
      lastSession: sessionData,
      snapshotHtml: snapshotHtml
    });
    
    // 尝试同步到云端
    try {
      if (cloudSync.isEnabled) {
        await cloudSync.saveToCloud(sessionData);
        console.log('Session saved locally and synced to cloud');
        
        // 显示云同步成功通知
        showNotification(chrome.i18n.getMessage('cloudSyncSuccess'), 'success');
      } else {
        console.log('Session saved locally (cloud sync disabled)');
      }
    } catch (error) {
      console.warn('Cloud sync failed, data saved locally only:', error);
      showNotification(chrome.i18n.getMessage('cloudSyncFailed'), 'warning');
    }
    
    console.log('Session saved successfully:', sessionData);
    return sessionData;
    
  } catch (error) {
    console.error('Failed to save session:', error);
    throw error;
  }
}

// 获取页面描述
async function getPageDescription(tab) {
  try {
    // 检查标签页状态
    if (!tab.id || tab.discarded) {
      return chrome.i18n.getMessage('noDescription') || 'No description available';
    }
    
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        try {
          // 优先级1：meta描述
          const metaDesc = document.querySelector('meta[name="description"]');
          if (metaDesc && metaDesc.content && metaDesc.content.trim().length > 10) {
            return metaDesc.content.trim().substring(0, 120);
          }
          
          // 优先级2：OpenGraph描述
          const ogDesc = document.querySelector('meta[property="og:description"]');
          if (ogDesc && ogDesc.content && ogDesc.content.trim().length > 10) {
            return ogDesc.content.trim().substring(0, 120);
          }
          
          // 优先级3：第一个有意义的段落
          const paragraphs = document.querySelectorAll('p');
          for (const p of paragraphs) {
            const text = p.textContent?.trim();
            if (text && text.length > 20) {
              return text.substring(0, 120);
            }
          }
          
          // 优先级4：文章内容
          const article = document.querySelector('article');
          if (article) {
            const text = article.textContent?.trim();
            if (text && text.length > 20) {
              return text.substring(0, 120);
            }
          }
          
          // 最后：使用页面标题
          const title = document.title?.trim();
          if (title && title.length > 5) {
            return title.substring(0, 80);
          }
          
          return 'No description available';
        } catch (innerError) {
          return 'Description extraction failed';
        }
      }
    });
    
    const result = results?.[0]?.result;
    if (result && typeof result === 'string' && result.length > 5) {
      return result;
    }
    
    return chrome.i18n.getMessage('noDescription') || 'No description available';
    
  } catch (error) {
    debugLog('Cannot get page description for:', tab.url, error.message);
    return chrome.i18n.getMessage('noDescription') || 'No description available';
  }
}

// 如果有可用快照则打开
async function openSnapshotPageIfAvailable() {
  try {
    const stored = await chrome.storage.local.get(['lastSession']);
    if (stored.lastSession && stored.lastSession.windows.length > 0) {
      console.log('Opening snapshot page');
      
      // 生成快照HTML
      const snapshotHtml = await generateSnapshotHTML(stored.lastSession);
      await chrome.storage.local.set({ snapshotHtml: snapshotHtml });
      
      // 创建快照页面
      chrome.tabs.create({
        url: chrome.runtime.getURL('snapshot.html'),
        active: true
      });
    } else {
      console.log('No session data available');
    }
  } catch (error) {
    console.error('Failed to open snapshot page:', error);
  }
}

// 生成快照HTML
async function generateSnapshotHTML(sessionData) {
  const browserLang = chrome.i18n.getUILanguage();
  const isZhCN = browserLang.startsWith('zh');
  const locale = isZhCN ? 'zh-CN' : 'en-US';
  const date = new Date(sessionData.timestamp).toLocaleString(locale);
  
  let totalTabs = 0;
  let allTabs = [];
  let totalGroups = Object.keys(sessionData.groups).length;
  sessionData.windows.forEach(window => {
    totalTabs += window.tabs.length;
    allTabs.push(...window.tabs);
  });
  
  // 计算总内存占用预估
  const totalMemoryMB = estimateTabMemoryUsage(allTabs);
  const memoryUsageText = getMemoryUsageText(totalTabs, totalMemoryMB);
  
  // 获取当前打开的标签页内存占用
  let currentMemoryMB = 0;
  let currentTabsCount = 0;
  let currentMemoryText = '';
  
  try {
    // 获取当前所有打开的标签页
    const currentWindows = await chrome.windows.getAll({ populate: true });
    const currentTabs = [];
    
    currentWindows.forEach(window => {
      window.tabs.forEach(tab => {
        if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
          currentTabs.push(tab);
        }
      });
    });
    
    currentTabsCount = currentTabs.length;
    currentMemoryMB = estimateTabMemoryUsage(currentTabs);
    
    const isZhCN = browserLang.startsWith('zh');
    currentMemoryText = isZhCN ? 
      `当前 ${currentTabsCount} 个标签页 · ${formatMemorySize(currentMemoryMB)}` :
      `Current ${currentTabsCount} tabs · ${formatMemorySize(currentMemoryMB)}`;
  } catch (error) {
    console.error('Failed to get current tabs memory usage:', error);
  }

  const title = chrome.i18n.getMessage('snapshotPageTitle', [date]);
  const langAttr = isZhCN ? 'zh-CN' : 'en';
  
  let html = `
<!DOCTYPE html>
<html lang="${langAttr}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link rel="icon" type="image/png" href="icons/icon32.png">
    <style>
        /* CSS 变量定义 - 浅色模式 */
        :root {
            --bg-primary: linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #f5576c 75%, #4facfe 100%);
            --bg-secondary: rgba(255, 255, 255, 0.95);
            --bg-card: rgba(255, 255, 255, 0.95);
            --bg-grid: linear-gradient(135deg, rgba(248, 250, 252, 0.4) 0%, rgba(241, 245, 249, 0.6) 50%, rgba(248, 250, 252, 0.4) 100%);
            --text-primary: #2c3e50;
            --text-secondary: #64748b;
            --text-muted: #6b7280;
            --border-color: rgba(255, 255, 255, 0.3);
            --border-hover: rgba(102, 126, 234, 0.3);
            --shadow-main: 0 4px 16px rgba(31, 38, 135, 0.1);
            --shadow-hover: 0 16px 40px rgba(102, 126, 234, 0.2);
            --gradient-accent: linear-gradient(135deg, rgba(74, 108, 247, 0.05) 0%, rgba(102, 126, 234, 0.05) 100%);
        }

        /* 深色模式变量 */
        @media (prefers-color-scheme: dark) {
            :root {
                --bg-primary: linear-gradient(135deg, #1a1a2e 0%, #16213e 25%, #0f3460 50%, #533483 75%, #16537e 100%);
                --bg-secondary: rgba(30, 30, 46, 0.95);
                --bg-card: rgba(42, 42, 64, 0.95);
                --bg-grid: linear-gradient(135deg, rgba(30, 30, 46, 0.4) 0%, rgba(42, 42, 64, 0.6) 50%, rgba(30, 30, 46, 0.4) 100%);
                --text-primary: #e2e8f0;
                --text-secondary: #94a3b8;
                --text-muted: #64748b;
                --border-color: rgba(100, 116, 139, 0.3);
                --border-hover: rgba(139, 92, 246, 0.4);
                --shadow-main: 0 4px 16px rgba(0, 0, 0, 0.3);
                --shadow-hover: 0 16px 40px rgba(139, 92, 246, 0.3);
                --gradient-accent: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%);
            }
        }

        /* 手动深色模式切换 */
        [data-theme="dark"] {
            --bg-primary: linear-gradient(135deg, #1a1a2e 0%, #16213e 25%, #0f3460 50%, #533483 75%, #16537e 100%);
            --bg-secondary: rgba(30, 30, 46, 0.95);
            --bg-card: rgba(42, 42, 64, 0.95);
            --bg-grid: linear-gradient(135deg, rgba(30, 30, 46, 0.4) 0%, rgba(42, 42, 64, 0.6) 50%, rgba(30, 30, 46, 0.4) 100%);
            --text-primary: #e2e8f0;
            --text-secondary: #94a3b8;
            --text-muted: #64748b;
            --border-color: rgba(100, 116, 139, 0.3);
            --border-hover: rgba(139, 92, 246, 0.4);
            --shadow-main: 0 4px 16px rgba(0, 0, 0, 0.3);
            --shadow-hover: 0 16px 40px rgba(139, 92, 246, 0.3);
            --gradient-accent: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%);
        }

        [data-theme="light"] {
            --bg-primary: linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #f5576c 75%, #4facfe 100%);
            --bg-secondary: rgba(255, 255, 255, 0.95);
            --bg-card: rgba(255, 255, 255, 0.95);
            --bg-grid: linear-gradient(135deg, rgba(248, 250, 252, 0.4) 0%, rgba(241, 245, 249, 0.6) 50%, rgba(248, 250, 252, 0.4) 100%);
            --text-primary: #2c3e50;
            --text-secondary: #64748b;
            --text-muted: #6b7280;
            --border-color: rgba(255, 255, 255, 0.3);
            --border-hover: rgba(102, 126, 234, 0.3);
            --shadow-main: 0 4px 16px rgba(31, 38, 135, 0.1);
            --shadow-hover: 0 16px 40px rgba(102, 126, 234, 0.2);
            --gradient-accent: linear-gradient(135deg, rgba(74, 108, 247, 0.05) 0%, rgba(102, 126, 234, 0.05) 100%);
        }
        
        * {
            box-sizing: border-box;
        }
        
        /* 全局文本溢出防护 */
        .tab-card, .tab-card * {
            word-wrap: break-word;
            overflow-wrap: break-word;
            min-width: 0;
        }
        
        /* 调试样式 - 可以临时启用查看网格边界 */
        .debug .tabs-grid {
            border: 2px solid red !important;
            background: rgba(255, 0, 0, 0.1) !important;
        }
        
        .debug .tab-card {
            border: 1px solid blue !important;
            background: rgba(0, 0, 255, 0.1) !important;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            margin: 0;
            padding: 0;
            background: var(--bg-primary);
            background-size: 400% 400%;
            animation: gradientShift 20s ease infinite;
            min-height: 100vh;
            line-height: 1.6;
            color: var(--text-primary);
        }
        
        @keyframes gradientShift {
            0% { background-position: 0% 50%; }
            25% { background-position: 100% 50%; }
            50% { background-position: 100% 100%; }
            75% { background-position: 50% 100%; }
            100% { background-position: 0% 50%; }
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .main-card {
            background: rgba(255, 255, 255, 0.98);
            backdrop-filter: blur(25px);
            border-radius: 24px;
            box-shadow: 
                0 32px 64px rgba(0,0,0,0.2),
                0 16px 32px rgba(0,0,0,0.1),
                0 0 0 1px rgba(255,255,255,0.3);
            overflow: hidden;
            animation: slideInUp 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
            border: 1px solid rgba(255,255,255,0.2);
            position: relative;
        }
        
        @keyframes slideInUp {
            0% {
                opacity: 0;
                transform: translateY(40px) scale(0.95);
            }
            60% {
                opacity: 0.8;
                transform: translateY(-5px) scale(1.02);
            }
            100% {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }
        
        .header {
            background: linear-gradient(135deg, 
                rgba(74, 108, 247, 0.9) 0%, 
                rgba(102, 126, 234, 0.9) 50%,
                rgba(139, 92, 246, 0.9) 100%
            );
            color: white;
            padding: 12px 18px;
            position: relative;
            overflow: hidden;
            backdrop-filter: blur(10px);
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        
        .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, 
                transparent, 
                rgba(255,255,255,0.3) 20%, 
                rgba(255,255,255,0.1) 50%,
                rgba(255,255,255,0.3) 80%,
                transparent
            );
            animation: shimmer 4s infinite;
            z-index: 1;
        }
        
        @keyframes shimmer {
            0% { 
                left: -100%; 
                opacity: 0;
            }
            50% { 
                opacity: 1;
            }
            100% { 
                left: 100%; 
                opacity: 0;
            }
        }
        
        .header-content {
            position: relative;
            z-index: 1;
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 13px;
        }
        
        .header-left {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .header-icon {
            width: 36px;
            height: 36px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: headerIconFloat 3s ease-in-out infinite;
        }
        
        @keyframes headerIconFloat {
            0%, 100% {
                transform: translateY(0px) rotate(0deg);
            }
            50% {
                transform: translateY(-3px) rotate(1deg);
            }
        }
        
        .header-title-section {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        
        .header h1 {
            margin: 0;
            font-size: 1.3em;
            font-weight: 300;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
            line-height: 1.1;
        }
        
        .header-current-stats {
            font-size: 0.75em;
            opacity: 0.85;
            color: rgba(255, 255, 255, 0.9);
            font-weight: 400;
        }
        
        
        .header-right {
            font-size: 0.95em;
            opacity: 0.9;
            font-weight: 300;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .header-action-btn {
            border: none;
            border-radius: 12px;
            cursor: pointer;
            padding: 0;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            font-family: inherit;
            width: 48px;
            height: 48px;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(10px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            box-sizing: border-box;
            position: relative;
        }
        
        .restore-snapshot-btn {
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.9) 0%, rgba(118, 75, 162, 0.9) 100%);
            color: white;
            border: 1px solid rgba(102, 126, 234, 0.4);
        }
        
        .restore-snapshot-btn:hover {
            background: linear-gradient(135deg, rgba(102, 126, 234, 1) 0%, rgba(118, 75, 162, 1) 100%);
            border-color: rgba(102, 126, 234, 0.6);
            transform: translateY(-2px) scale(1.08);
            box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
        }
        
        .set-homepage-btn {
            background: linear-gradient(135deg, rgba(59, 130, 246, 0.9) 0%, rgba(37, 99, 235, 0.9) 100%);
            color: white;
            border: 1px solid rgba(59, 130, 246, 0.4);
        }
        
        .set-homepage-btn:hover {
            background: linear-gradient(135deg, rgba(59, 130, 246, 1) 0%, rgba(37, 99, 235, 1) 100%);
            border-color: rgba(59, 130, 246, 0.6);
            transform: translateY(-2px) scale(1.08);
            box-shadow: 0 8px 20px rgba(59, 130, 246, 0.4);
        }
        
        
        .content {
            padding: 26px;
        }
        
        .tooltip {
            position: absolute;
            background: rgba(0,0,0,0.9);
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 0.8em;
            pointer-events: none;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s ease;
            word-break: break-all;
        }
        
        .tooltip.show {
            opacity: 1;
        }
        
        /* 增强按钮tooltip样式 */
        .header-action-btn[title]:hover::after {
            content: attr(title);
            position: absolute;
            bottom: -35px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 8px 12px;
            border-radius: 8px;
            font-size: 0.75em;
            white-space: nowrap;
            z-index: 1001;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(10px);
        }
        
        .header-action-btn[title]:hover::before {
            content: '';
            position: absolute;
            bottom: -25px;
            left: 50%;
            transform: translateX(-50%);
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-bottom: 6px solid rgba(0, 0, 0, 0.9);
            z-index: 1001;
        }
        
        .tab-group-section {
            margin-bottom: 17px;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            border-radius: 16px;
            box-shadow: 
                0 8px 32px rgba(102, 126, 234, 0.1),
                0 4px 16px rgba(0, 0, 0, 0.05),
                inset 0 1px 0 rgba(255, 255, 255, 0.8);
            overflow: hidden;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            border: 1px solid rgba(255, 255, 255, 0.3);
            position: relative;
        }
        
        .tab-group-section::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, 
                rgba(102, 126, 234, 0.6) 0%,
                rgba(118, 75, 162, 0.6) 50%,
                rgba(240, 147, 251, 0.6) 100%);
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        
        .tab-group-section:hover {
            transform: translateY(-4px) scale(1.01);
            box-shadow: 
                0 16px 48px rgba(102, 126, 234, 0.15),
                0 8px 24px rgba(0, 0, 0, 0.08),
                inset 0 1px 0 rgba(255, 255, 255, 0.9);
            border-color: rgba(102, 126, 234, 0.2);
        }
        
        .tab-group-section:hover::before {
            opacity: 1;
        }
        
        .group-header {
            background: linear-gradient(135deg, 
                rgba(248, 250, 255, 0.95) 0%, 
                rgba(240, 245, 255, 0.95) 50%,
                rgba(235, 240, 255, 0.95) 100%
            );
            backdrop-filter: blur(15px);
            padding: 13px 16px;
            display: flex;
            align-items: center;
            gap: 10px;
            border-bottom: 1px solid rgba(74, 108, 247, 0.12);
            border-top: 1px solid rgba(255,255,255,0.5);
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            user-select: none;
            box-shadow: 0 4px 16px rgba(74, 108, 247, 0.05);
        }
        
        .group-header:hover {
            background: linear-gradient(135deg, 
                rgba(235, 240, 255, 0.98) 0%, 
                rgba(225, 235, 255, 0.98) 50%,
                rgba(220, 230, 255, 0.98) 100%
            );
            transform: translateY(-1px);
            box-shadow: 0 6px 20px rgba(74, 108, 247, 0.1);
        }
        
        .group-indicator {
            width: 3px;
            height: 23px;
            border-radius: 2px;
            position: relative;
            box-shadow: 0 2px 5px rgba(0,0,0,0.15);
        }
        
        .group-indicator::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 10px;
            height: 10px;
            background: inherit;
            border-radius: 50%;
            box-shadow: 0 0 0 2px rgba(255,255,255,0.9), 0 2px 6px rgba(0,0,0,0.2);
        }
        
        .group-info {
            flex: 1;
        }
        
        .group-title {
            font-size: 1.05em;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 2px;
            line-height: 1.3;
        }
        
        .group-count {
            font-size: 0.8em;
            color: #6c757d;
            font-weight: 500;
        }
        
        .group-actions {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .group-restore-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            border: 1px solid rgba(102, 126, 234, 0.3);
            border-radius: 8px;
            background: rgba(102, 126, 234, 0.8);
            color: white;
            cursor: pointer;
            transition: all 0.3s ease;
            opacity: 0.9;
        }
        
        .group-restore-btn:hover {
            background: rgba(102, 126, 234, 1);
            border-color: rgba(102, 126, 234, 0.6);
            transform: scale(1.05);
            opacity: 1;
            box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
        }
        
        .group-restore-btn svg {
            width: 14px;
            height: 14px;
        }
        
        .group-toggle {
            width: 44px;
            height: 24px;
            background: rgba(102, 126, 234, 0.2);
            border-radius: 12px;
            cursor: pointer;
            position: relative;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            border: 2px solid rgba(102, 126, 234, 0.3);
            box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .group-toggle:hover {
            background: rgba(102, 126, 234, 0.3);
            border-color: rgba(102, 126, 234, 0.5);
            box-shadow: 
                inset 0 1px 3px rgba(0, 0, 0, 0.1),
                0 0 8px rgba(102, 126, 234, 0.3);
        }
        
        .toggle-switch {
            width: 18px;
            height: 18px;
            background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
            border-radius: 50%;
            position: absolute;
            top: 1px;
            left: 1px;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 
                0 2px 4px rgba(0, 0, 0, 0.2),
                0 1px 2px rgba(0, 0, 0, 0.1);
        }
        
        .group-header.collapsed .group-toggle {
            background: rgba(74, 108, 247, 0.8);
            border-color: rgba(74, 108, 247, 0.6);
        }
        
        .group-header.collapsed .toggle-switch {
            transform: translateX(20px);
            background: linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%);
            box-shadow: 
                0 2px 6px rgba(74, 108, 247, 0.3),
                0 1px 3px rgba(0, 0, 0, 0.2);
        }
        
        .group-header.collapsed + .tabs-grid {
            display: none !important;
        }
        
        .tabs-grid {
            display: grid !important;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)) !important;
            gap: 12px !important;
            padding: 16px !important;
            background: linear-gradient(135deg, 
                rgba(248, 250, 252, 0.4) 0%, 
                rgba(241, 245, 249, 0.6) 50%,
                rgba(248, 250, 252, 0.4) 100%
            );
            backdrop-filter: blur(5px);
            align-items: start !important;
            width: 100% !important;
            box-sizing: border-box !important;
            grid-auto-rows: auto !important;
            /* 重置可能冲突的样式 */
            float: none !important;
            position: static !important;
            flex: none !important;
            table-layout: auto !important;
            border-collapse: separate !important;
        }
        
        /* 大屏幕上确保最多5列 */
        @media (min-width: 1400px) {
            .tabs-grid {
                grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                max-width: none;
            }
        }
        
        @media (min-width: 1800px) {
            .tabs-grid {
                grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            }
        }
        
        .tab-card {
            background: rgba(255, 255, 255, 0.95) !important;
            backdrop-filter: blur(10px) !important;
            border-radius: 10px !important;
            padding: 12px !important;
            cursor: pointer;
            transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
            border: 1px solid rgba(255,255,255,0.3) !important;
            position: relative;
            overflow: hidden;
            min-height: 80px !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            grid-column: span 1 !important;
            margin: 0 !important;
            box-shadow: 0 2px 6px rgba(31, 38, 135, 0.06) !important;
        }
        
        .tab-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 50%;
            background: linear-gradient(135deg, rgba(74, 108, 247, 0.05) 0%, rgba(102, 126, 234, 0.05) 100%);
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        
        .tab-card:hover::before {
            opacity: 1;
        }
        
        .tab-card:hover {
            transform: translateY(-12px) scale(1.03) rotateX(5deg);
            box-shadow: 
                0 25px 50px rgba(102, 126, 234, 0.25),
                0 15px 35px rgba(139, 92, 246, 0.15),
                0 0 0 1px rgba(255,255,255,0.5);
            border-color: rgba(255,255,255,0.6);
            background: rgba(255, 255, 255, 0.98) !important;
        }
        
        .tab-header {
            display: flex;
            align-items: flex-start;
            position: relative;
            z-index: 1;
            width: 100%;
            min-width: 0;
            gap: 7px;
        }
        
        .favicon {
            width: 20px;
            height: 20px;
            border-radius: 4px;
            background: rgba(0,0,0,0.05);
            padding: 1px;
            flex-shrink: 0;
            margin-top: 1px;
        }
        
        .tab-title {
            font-weight: 600;
            color: #2c3e50;
            font-size: 0.8em;
            line-height: 1.2;
            flex: 1;
            margin: 0;
            word-wrap: break-word;
            word-break: break-word;
            hyphens: auto;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            position: relative;
            z-index: 1;
            min-height: 1.4em;
            max-width: 100%;
        }
        
        .tab-description {
            color: #5a6c7d;
            font-size: 0.8em;
            line-height: 1.3;
            background: rgba(248, 249, 250, 0.9);
            padding: 7px 8px;
            border-radius: 5px;
            border-left: 2px solid transparent;
            margin-top: 7px;
            position: absolute;
            left: 10px;
            right: 10px;
            bottom: 10px;
            z-index: 2;
            opacity: 0;
            transform: translateY(7px);
            transition: all 0.3s ease;
            pointer-events: none;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            box-shadow: 0 3px 8px rgba(0,0,0,0.1);
        }
        
        .tab-card:hover .tab-description {
            opacity: 1;
            transform: translateY(0);
            border-left-color: rgba(102, 126, 234, 0.8);
            background: rgba(255, 255, 255, 0.95);
        }
        
        .pinned-indicator {
            position: absolute;
            top: 8px;
            right: 8px;
            background: linear-gradient(135deg, #8b5cf6, #6366f1);
            color: white;
            font-size: 0.65em;
            padding: 3px 6px;
            border-radius: 8px;
            font-weight: 600;
            box-shadow: 0 2px 5px rgba(139, 92, 246, 0.3);
            z-index: 3;
        }
        
        .tab-actions {
            position: absolute;
            top: 8px;
            right: 8px;
            display: flex;
            gap: 4px;
            opacity: 0;
            transition: all 0.3s ease;
            z-index: 3;
        }
        
        .tab-card:hover .tab-actions {
            opacity: 1;
        }
        
        .tab-action-btn {
            width: 20px;
            height: 20px;
            border-radius: 4px;
            border: 1px solid rgba(74, 108, 247, 0.2);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            transition: all 0.3s ease;
            background: rgba(255, 255, 255, 0.9);
            color: #5a6c7d;
            box-shadow: 0 2px 5px rgba(74, 108, 247, 0.1);
        }
        
        .tab-action-btn:hover {
            transform: scale(1.05);
            border-color: rgba(74, 108, 247, 0.4);
            box-shadow: 0 4px 12px rgba(74, 108, 247, 0.2);
        }
        
        .delete-btn {
            background: rgba(99, 102, 241, 0.9);
            color: white;
            border-color: rgba(99, 102, 241, 0.3);
        }
        
        .delete-btn:hover {
            background: rgba(99, 102, 241, 1);
            border-color: rgba(99, 102, 241, 0.5);
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
        }
        
        .tab-card.pinned .tab-actions {
            right: 34px;
        }
        
        .no-tabs {
            text-align: center;
            padding: 80px 40px;
            color: #5a6c7d;
            font-size: 1.1em;
            background: rgba(255, 255, 255, 0.8);
            border-radius: 20px;
            margin: 20px 0;
            border: 1px solid rgba(74, 108, 247, 0.1);
        }
        
        .no-tabs::before {
            content: '📭';
            display: block;
            font-size: 3em;
            margin-bottom: 20px;
            opacity: 0.5;
        }
        
        /* 中等屏幕 - 平板和小桌面 */
        @media (max-width: 1200px) {
            .tabs-grid {
                grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)) !important;
                gap: 10px !important;
                padding: 14px !important;
            }
        }
        
        /* 小屏幕 - 平板竖屏 */
        @media (max-width: 768px) {
            .container {
                padding: 10px;
            }
            
            .header {
                padding: 15px;
            }
            
            .header-content {
                flex-direction: column;
                align-items: flex-start;
                gap: 15px;
            }
            
            .header h1 {
                font-size: 1.5em;
            }
            
            
            .content {
                padding: 20px;
            }
            
            .tabs-grid {
                grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                gap: 8px;
                padding: 12px;
            }
            
            .group-header {
                padding: 15px 20px;
            }
            
            .tab-card {
                min-height: 18px;
                padding: 4px;
            }
            
            .tab-title {
                font-size: 0.8em;
            }
        }
        
        /* 手机屏幕 */
        @media (max-width: 480px) {
            .header {
                padding: 12px;
            }
            
            .header h1 {
                font-size: 1.3em;
            }
            
            .header-left {
                flex-direction: column;
                align-items: flex-start;
                gap: 10px;
            }
            
            .header-right {
                font-size: 0.85em;
            }
            
            .tabs-grid {
                grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)) !important;
                padding: 8px;
                gap: 6px;
            }
            
            .tab-card {
                padding: 3px;
                min-height: 16px;
            }
            
            .tab-title {
                font-size: 0.8em;
                -webkit-line-clamp: 3;
            }
            
            .group-header {
                padding: 12px 15px;
            }
            
            .group-title {
                font-size: 1em;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="main-card">
            <div class="header">
                <div class="header-content">
                    <div class="header-left">
                        <img src="icons/icon128.png" alt="插件图标" class="header-icon">
                        <div class="header-title-section">
                            <h1>${chrome.i18n.getMessage('extensionName')}</h1>
                            <div class="header-current-stats">
                                ${currentMemoryText} | ${isZhCN ? '快照:' : 'Snapshot:'} ${totalTabs} ${chrome.i18n.getMessage('tabCount', [totalTabs.toString()]).replace(totalTabs + ' ', '')} · ${totalGroups} ${chrome.i18n.getMessage('groupCount', [totalGroups.toString()]).replace(totalGroups + ' ', '')} · ${formatMemorySize(totalMemoryMB)}
                            </div>
                        </div>
                    </div>
                    <div class="header-right">
                        <button id="setHomepageBtn" class="header-action-btn set-homepage-btn" title="${chrome.i18n.getMessage('setHomepage')}">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                            </svg>
                        </button>
                        <button id="restoreSnapshotBtn" class="header-action-btn restore-snapshot-btn" title="${chrome.i18n.getMessage('restoreFullSnapshot')} (${memoryUsageText})">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M13.5 7H15.5L12 3.5 8.5 7H10.5V14H13.5V7ZM6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19V11H16V19H8V11H6V19Z"/>
                            </svg>
                        </button>
                        <span style="opacity: 0.9;">${chrome.i18n.getMessage('saveTime', [date])}</span>
                    </div>
                </div>
            </div>
            
            <div class="content">
                <div class="tooltip" id="urlTooltip"></div>
  `;

  // 收集所有窗口的标签页并按分组整理
  const allGroupedTabs = {};
  const allUngroupedTabs = [];

  sessionData.windows.forEach(window => {
    window.tabs.forEach(tab => {
      if (tab.groupId && tab.groupId !== -1) {
        if (!allGroupedTabs[tab.groupId]) {
          allGroupedTabs[tab.groupId] = [];
        }
        allGroupedTabs[tab.groupId].push(tab);
      } else {
        allUngroupedTabs.push(tab);
      }
    });
  });

  // 显示分组的标签页
  for (const groupId in allGroupedTabs) {
    const group = sessionData.groups[groupId];
    const groupTabs = allGroupedTabs[groupId];
    
    html += `
      <div class="tab-group-section" data-group-id="${groupId}">
        <div class="group-header" data-group-id="${groupId}">
          <div class="group-indicator" style="background-color: ${getGroupColor(group?.color)}"></div>
          <div class="group-info">
            <div class="group-title">${group?.title || chrome.i18n.getMessage('unnamedGroup')}</div>
            <div class="group-count">${chrome.i18n.getMessage('tabCount', [groupTabs.length.toString()])}</div>
          </div>
          <div class="group-actions">
            <button class="group-restore-btn" data-group-id="${groupId}" title="${chrome.i18n.getMessage('restoreGroupButton')}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13.5 7H15.5L12 3.5 8.5 7H10.5V14H13.5V7ZM6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19V11H16V19H8V11H6V19Z"/>
              </svg>
            </button>
            <div class="group-toggle">
              <div class="toggle-switch"></div>
            </div>
          </div>
        </div>
        <div class="tabs-grid">
    `;
    
    groupTabs.forEach(tab => {
      html += generateTabHTML(tab);
    });
    
    html += '</div></div>';
  }

  // 显示未分组的标签页
  if (allUngroupedTabs.length > 0) {
    html += `
      <div class="tab-group-section" data-group-id="ungrouped">
        <div class="group-header" data-group-id="ungrouped">
          <div class="group-indicator" style="background-color: #6c757d"></div>
          <div class="group-info">
            <div class="group-title">${chrome.i18n.getMessage('ungroupedTabs')}</div>
            <div class="group-count">${chrome.i18n.getMessage('tabCount', [allUngroupedTabs.length.toString()])}</div>
          </div>
          <div class="group-actions">
            <button class="group-restore-btn" data-group-id="ungrouped" title="${chrome.i18n.getMessage('restoreGroupButton')}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13.5 7H15.5L12 3.5 8.5 7H10.5V14H13.5V7ZM6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19V11H16V19H8V11H6V19Z"/>
              </svg>
            </button>
            <div class="group-toggle">
              <div class="toggle-switch"></div>
            </div>
          </div>
        </div>
        <div class="tabs-grid">
    `;
    
    allUngroupedTabs.forEach(tab => {
      html += generateTabHTML(tab);
    });
    
    html += '</div></div>';
  }

  if (totalTabs === 0) {
    html += `<div class="no-tabs">${chrome.i18n.getMessage('noTabs')}</div>`;
  }

  html += `
            </div>
        </div>
    </div>
    <script src="snapshot-script.js"></script>
</body>
</html>
  `;

  return html;
}

// 生成单个标签页的HTML  
function generateTabHTML(tab) {
  const favicon = tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="%23999" d="M2 3a1 1 0 011-1h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3z"/></svg>';
  
  const actionButtons = `
    <div class="tab-actions">
      <button class="tab-action-btn delete-btn" title="${chrome.i18n.getMessage('deleteTab')}" data-action="delete">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <path d="M9 3v8a1 1 0 01-1 1H4a1 1 0 01-1-1V3M2 3h8M7 1H5a1 1 0 00-1 1v1h4V2a1 1 0 00-1-1z"/>
        </svg>
      </button>
    </div>
  `;
  
  const defaultTitle = chrome.i18n.getMessage('noDescription');
  const defaultDescription = chrome.i18n.getMessage('noDescription');
  const pinnedText = chrome.i18n.getMessage('pinned');
  
  return `
    <div class="tab-card ${tab.pinned ? 'pinned' : ''}" data-url="${tab.url}" data-title="${tab.title || defaultTitle}" data-description="${tab.description || defaultDescription}" data-tab-id="${tab.id || Math.random().toString(36).substr(2, 9)}">
      ${tab.pinned ? `<div class="pinned-indicator">📌 ${pinnedText}</div>` : ''}
      ${actionButtons}
      <div class="tab-header">
        <img class="favicon" src="${favicon}" alt="网站图标">
        <div class="tab-title">${tab.title || defaultTitle}</div>
      </div>
      <div class="tab-description" style="display: none;">${tab.description || defaultDescription}</div>
    </div>
  `;
}

// 获取分组颜色 - 统一蓝色系配色
function getGroupColor(color) {
  const colors = {
    grey: '#5a6c7d',
    blue: '#4a6cf7',
    red: '#6366f1',
    yellow: '#8b5cf6',
    green: '#667eea',
    pink: '#7c3aed',
    purple: '#818cf8',
    cyan: '#3b82f6',
    orange: '#6366f1'
  };
  return colors[color] || '#5a6c7d';
}

// 恢复单个分组的快照
async function restoreGroupSnapshot(groupId, groupData) {
  console.log('Restoring group snapshot:', groupId, groupData);
  
  try {
    // 获取当前所有打开的标签页URL
    const currentWindows = await chrome.windows.getAll({ populate: true });
    const currentOpenUrls = new Set();
    
    currentWindows.forEach(window => {
      window.tabs.forEach(tab => {
        if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
          currentOpenUrls.add(tab.url);
        }
      });
    });
    
    console.log('Currently open URLs:', currentOpenUrls.size);
    
    // 过滤出需要恢复的标签页（排除已打开的）
    const tabsToRestore = [];
    let skippedTabs = 0;
    
    if (groupData.tabs && Array.isArray(groupData.tabs)) {
      groupData.tabs.forEach(tab => {
        if (currentOpenUrls.has(tab.url)) {
          skippedTabs++;
          console.log('Skipping already open tab:', tab.title, tab.url);
        } else {
          tabsToRestore.push(tab);
        }
      });
    }
    
    console.log('Tabs to restore in group:', tabsToRestore.length);
    console.log('Skipped tabs in group:', skippedTabs);
    
    if (tabsToRestore.length === 0) {
      const message = skippedTabs > 0 
        ? chrome.i18n.getMessage('allGroupTabsOpen', [groupData.title, skippedTabs.toString()])
        : chrome.i18n.getMessage('noValidGroupTabs', [groupData.title]);
        
      return {
        tabsCount: 0,
        skippedCount: skippedTabs,
        message: message
      };
    }
    
    // 创建新窗口或使用现有窗口
    let targetWindow;
    try {
      const currentWindow = await chrome.windows.getCurrent();
      if (currentWindow && currentWindow.type === 'normal') {
        targetWindow = currentWindow;
        console.log('Using current window for group restore:', targetWindow.id);
      } else {
        throw new Error('Current window not suitable');
      }
    } catch (error) {
      console.log('Creating new window for group restore...');
      targetWindow = await chrome.windows.create({
        focused: true,
        state: 'maximized'
      });
      console.log('Created new window:', targetWindow.id);
    }
    
    // 创建标签页
    const createdTabs = [];
    let totalTabsRestored = 0;
    
    for (const tab of tabsToRestore) {
      try {
        const newTab = await chrome.tabs.create({
          windowId: targetWindow.id,
          url: tab.url,
          pinned: tab.pinned || false,
          active: false
        });
        
        createdTabs.push({
          original: tab,
          new: newTab
        });
        
        totalTabsRestored++;
        console.log(`Created tab for group: ${tab.title}`);
        
        // 添加小延迟避免过快创建
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Failed to create tab for URL: ${tab.url}`, error);
      }
    }
    
    // 等待标签页创建完成后创建分组
    if (totalTabsRestored > 0) {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      try {
        // 验证所有标签页仍然存在
        const validTabIds = [];
        for (const createdTab of createdTabs) {
          try {
            await chrome.tabs.get(createdTab.new.id);
            validTabIds.push(createdTab.new.id);
          } catch (error) {
            console.log(`Tab ${createdTab.new.id} no longer exists`);
          }
        }
        
        if (validTabIds.length > 0) {
          // 创建标签页分组
          const newGroupId = await chrome.tabs.group({
            tabIds: validTabIds
          });
          
          // 设置分组属性
          await chrome.tabGroups.update(newGroupId, {
            title: groupData.title || chrome.i18n.getMessage('restoredGroup'),
            color: groupData.color || 'grey'
          });
          
          console.log(`Created group "${groupData.title}" with ${validTabIds.length} tabs`);
        }
        
      } catch (error) {
        console.error('Failed to create group for restored tabs:', error);
        // 即使分组失败，标签页恢复仍然成功
      }
    }
    
    const message = skippedTabs > 0 
      ? chrome.i18n.getMessage('restoreCompleted', [groupData.title, totalTabsRestored.toString(), skippedTabs.toString()])
      : chrome.i18n.getMessage('restoreCompleted', [groupData.title, totalTabsRestored.toString(), '0']);
    
    console.log(`Group restore completed: ${totalTabsRestored} tabs restored, ${skippedTabs} skipped`);
    
    return {
      tabsCount: totalTabsRestored,
      skippedCount: skippedTabs,
      message: message
    };
    
  } catch (error) {
    console.error('Failed to restore group snapshot:', error);
    throw error;
  }
}

// 保存会话并关闭当前活动窗口（用于快捷键）
async function saveAndCloseCurrentWindow() {
  console.log('Save and close current window via shortcut');
  
  try {
    // 获取当前活动窗口
    const currentWindow = await chrome.windows.getCurrent();
    console.log('Current window ID:', currentWindow.id);
    
    // 调用现有的保存并关闭函数
    await saveAndCloseAllTabs(currentWindow.id);
    
  } catch (error) {
    console.error('Failed to save and close current window:', error);
    throw error;
  }
}

// 简化的会话保存函数（用于保存并关闭功能）
async function saveBasicSession() {
  console.log('Saving basic session data...');
  
  try {
    const windows = await chrome.windows.getAll({ populate: true });
    const sessionData = {
      timestamp: Date.now(),
      windows: []
    };

    // 获取标签页分组
    let tabGroups = {};
    try {
      const groups = await chrome.tabGroups.query({});
      groups.forEach(group => {
        tabGroups[group.id] = {
          title: group.title || 'Unnamed Group',
          color: group.color
        };
      });
    } catch (error) {
      console.log('Unable to get tab groups:', error);
    }

    // 处理每个窗口（跳过复杂操作）
    for (const window of windows) {
      const windowData = {
        id: window.id,
        tabs: []
      };

      for (const tab of window.tabs) {
        if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
          const tabData = {
            url: tab.url,
            title: tab.title,
            favIconUrl: tab.favIconUrl,
            groupId: tab.groupId,
            pinned: tab.pinned,
            description: 'No description available'
          };
          windowData.tabs.push(tabData);
        }
      }
      
      if (windowData.tabs.length > 0) {
        sessionData.windows.push(windowData);
      }
    }

    sessionData.groups = tabGroups;

    // 只保存到本地存储，跳过HTML生成和云同步
    await chrome.storage.local.set({ 
      lastSession: sessionData
    });
    
    console.log('Basic session saved successfully');
    return sessionData;
    
  } catch (error) {
    console.error('Failed to save basic session:', error);
    throw error;
  }
}

// 保存会话并关闭所有标签页，然后显示快照页面
async function saveAndCloseAllTabs(windowId) {
  console.log('=== Starting Save and Close All Tabs (Simplified Method) ===');
  
  try {
    // 步骤1：保存完整会话数据
    console.log('Step 1: Saving complete session data...');
    try {
      await saveCurrentSession();
      console.log('✅ Complete session saved with HTML generation');
    } catch (saveError) {
      console.warn('⚠️ Full session save failed, trying basic save:', saveError.message);
      // 如果完整保存失败，尝试基本保存
      try {
        await saveBasicSession();
        console.log('✅ Basic session saved as fallback');
      } catch (basicSaveError) {
        console.warn('⚠️ Basic session save also failed, continuing:', basicSaveError.message);
      }
    }
    
    // 步骤2：获取当前窗口的活动标签页
    console.log('Step 2: Getting active tab...');
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) {
      throw new Error('No active tab found');
    }
    console.log(`Active tab: [${activeTab.id}] ${activeTab.title}`);
    
    // 步骤3：直接将活动标签页导航到快照页面
    console.log('Step 3: Navigate active tab to snapshot page...');
    const snapshotUrl = chrome.runtime.getURL('snapshot.html');
    await chrome.tabs.update(activeTab.id, { url: snapshotUrl });
    console.log('✅ Active tab updated to snapshot page');
    
    // 步骤4：等待导航开始
    console.log('Step 4: Brief wait for navigation...');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 步骤5：获取窗口中的所有其他标签页
    console.log('Step 5: Getting all other tabs to close...');
    const allTabs = await chrome.tabs.query({ currentWindow: true });
    const tabsToClose = allTabs.filter(tab => tab.id !== activeTab.id);
    
    console.log(`Found ${allTabs.length} total tabs, ${tabsToClose.length} to close:`);
    tabsToClose.forEach(tab => console.log(`  - [${tab.id}] ${tab.title?.substring(0,40)}`));
    
    // 步骤6：逐个关闭标签页
    let closedCount = 0;
    console.log('Step 6: Closing tabs one by one...');
    
    for (let i = 0; i < tabsToClose.length; i++) {
      const tab = tabsToClose[i];
      try {
        console.log(`Attempting to close tab ${i+1}/${tabsToClose.length}: [${tab.id}] ${tab.title?.substring(0,30)}`);
        
        // 直接尝试关闭，不检查是否存在
        await chrome.tabs.remove(tab.id);
        closedCount++;
        console.log(`✅ Successfully closed tab ${tab.id}`);
        
        // 很短的延迟
        if (i < tabsToClose.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
      } catch (error) {
        console.error(`❌ Failed to close tab ${tab.id}:`, {
          message: error.message,
          name: error.name,
          stack: error.stack?.substring(0, 200)
        });
      }
    }
    
    // 步骤7：验证最终状态
    console.log('Step 7: Verifying final state...');
    await new Promise(resolve => setTimeout(resolve, 200)); // 等待关闭操作完成
    
    const finalTabs = await chrome.tabs.query({ currentWindow: true });
    console.log(`Final state: ${finalTabs.length} tabs remaining:`);
    finalTabs.forEach(tab => console.log(`  ✓ [${tab.id}] ${tab.title}`));
    
    // 步骤8：确保快照页面是活动的
    console.log('Step 8: Ensuring snapshot tab is active...');
    const snapshotTabs = finalTabs.filter(tab => tab.url && tab.url.includes('snapshot.html'));
    if (snapshotTabs.length > 0) {
      await chrome.tabs.update(snapshotTabs[0].id, { active: true });
      console.log('✅ Snapshot tab activated');
    }
    
    const result = {
      success: true,
      closedTabs: closedCount,
      remainingTabs: finalTabs.length,
      initialTabs: allTabs.length,
      activeTabId: activeTab.id
    };
    
    console.log('=== Save and Close All Tabs Completed ===');
    console.log('Final Result:', result);
    return result;
    
  } catch (error) {
    console.error('❌ Save and Close All Tabs failed:', error);
    console.error('Full error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    throw error;
  }
}

// 恢复快照 - 只恢复当前未打开的标签页并恢复分组
async function restoreSnapshot(mode = 'fast') {
  console.log(`=== Starting restore snapshot in ${mode} mode ===`);
  
  try {
    // 检查是否有其他 Chrome 窗口打开
    const existingWindows = await chrome.windows.getAll();
    console.log('Existing windows:', existingWindows.length);
    
    // 如果没有其他窗口，使用当前窗口
    if (existingWindows.length === 0) {
      console.log('No existing windows, creating new one...');
    }
    // 尝试从云端获取更新的数据
    let sessionData = null;
    
    try {
      // 等待云同步服务初始化并检查云端数据
      if (cloudSync) {
        // 等待初始化完成
        while (!cloudSync.initialized) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        if (cloudSync.isEnabled && await cloudSync.hasNewerCloudData()) {
          console.log('Loading newer data from cloud...');
          sessionData = await cloudSync.loadFromCloud();
          showNotification(chrome.i18n.getMessage('cloudRestoreSuccess'), 'info');
        }
      }
    } catch (error) {
      console.warn('Failed to load from cloud, using local data:', error.message);
    }
    
    // 如果没有云端数据，使用本地数据
    if (!sessionData) {
      console.log('Loading session data from local storage...');
      const stored = await chrome.storage.local.get(['lastSession']);
      
      if (!stored.lastSession) {
        // 没有快照数据时返回友好提示
        console.log('No snapshot data found, prompting user to save first');
        return {
          success: false,
          noSnapshot: true,
          message: chrome.i18n.getMessage('noSnapshotPrompt') || '还没有保存过快照。请先点击"立即保存快照"按钮创建一个快照，然后再进行恢复。',
          tabsCount: 0,
          skippedCount: 0
        };
      }
      
      if (!stored.lastSession.windows || stored.lastSession.windows.length === 0) {
        // 快照数据为空时的友好提示
        console.log('Snapshot data is empty, prompting user to save new snapshot');
        return {
          success: false,
          emptySnapshot: true,
          message: chrome.i18n.getMessage('emptySnapshotPrompt') || '当前快照为空。请先保存一些标签页，然后再进行恢复。',
          tabsCount: 0,
          skippedCount: 0
        };
      }
      
      sessionData = stored.lastSession;
      console.log('✅ Loaded session data from local storage');
    }
    
    console.log('Session data summary:', {
      timestamp: sessionData.timestamp,
      windowsCount: sessionData.windows?.length || 0,
      totalTabs: sessionData.windows?.reduce((sum, win) => sum + (win.tabs?.length || 0), 0) || 0
    });
    
    // 获取当前所有打开的标签页
    const currentWindows = await chrome.windows.getAll({ populate: true });
    const currentOpenUrls = new Set();
    
    currentWindows.forEach(window => {
      window.tabs.forEach(tab => {
        if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
          currentOpenUrls.add(tab.url);
        }
      });
    });
    
    console.log('Currently open URLs:', currentOpenUrls.size);
    
    let totalTabsRestored = 0;
    let skippedTabs = 0;
    
    // 策略1: 尝试使用现有窗口或创建新窗口
    let newWindow;
    let useExistingWindow = false;
    
    try {
      // 先尝试获取当前活动窗口
      const currentWindow = await chrome.windows.getCurrent();
      if (currentWindow && currentWindow.type === 'normal') {
        console.log('Using current window for restore:', currentWindow.id);
        newWindow = currentWindow;
        useExistingWindow = true;
      } else {
        throw new Error('Current window not suitable');
      }
    } catch (error) {
      console.log('Cannot use current window, creating new one:', error.message);
      
      try {
        console.log('Creating new window for restore...');
        newWindow = await chrome.windows.create({
          focused: true,
          state: 'maximized',
          url: 'about:blank'  // 明确指定URL
        });
        console.log('Window created successfully:', newWindow.id);
        
        // 短暂等待确保窗口完全创建
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 验证窗口是否仍然存在
        await chrome.windows.get(newWindow.id);
        console.log('Window verified successfully');
        
      } catch (error) {
        console.error('Failed to create or verify window:', error);
        throw new Error(chrome.i18n.getMessage('loadingFailed') + ': ' + error.message);
      }
    }
    
    // 处理默认标签页（只在新建窗口时处理）
    let defaultTabsToRemove = [];
    if (!useExistingWindow) {
      try {
        console.log('Querying default tabs in new window:', newWindow.id);
        const defaultTabs = await chrome.tabs.query({ windowId: newWindow.id });
        console.log('Found default tabs:', defaultTabs.length);
        
        // 记录需要移除的默认标签页，但不立即移除
        defaultTabsToRemove = defaultTabs.filter(tab => 
          tab.url === 'chrome://newtab/' || 
          tab.url === 'about:blank' ||
          tab.url.startsWith('chrome-extension://')
        );
        
        console.log('Default tabs to remove later:', defaultTabsToRemove.length);
      } catch (error) {
        console.log('Failed to query default tabs, continuing...', error);
      }
    }
    
    // 收集需要恢复的标签页（排除已打开的）
    const tabsToRestore = [];
    const groupsToRestore = {};
    
    // 从所有窗口收集未打开的标签页
    sessionData.windows.forEach(window => {
      window.tabs.forEach(tab => {
        // 检查是否已经打开
        if (currentOpenUrls.has(tab.url)) {
          skippedTabs++;
          console.log('Skipping already open tab:', tab.title, tab.url);
          return;
        }
        
        tabsToRestore.push(tab);
        
        // 记录分组信息
        if (tab.groupId && tab.groupId !== -1 && sessionData.groups[tab.groupId]) {
          if (!groupsToRestore[tab.groupId]) {
            groupsToRestore[tab.groupId] = {
              ...sessionData.groups[tab.groupId],
              tabs: []
            };
          }
          groupsToRestore[tab.groupId].tabs.push(tab);
        }
      });
    });
    
    console.log('Total tabs in snapshot:', sessionData.windows.reduce((total, w) => total + w.tabs.length, 0));
    console.log('Already open tabs (skipped):', skippedTabs);
    console.log('Tabs to restore:', tabsToRestore.length);
    console.log('Groups to restore:', Object.keys(groupsToRestore).length);
    
    // 如果没有需要恢复的标签页
    if (tabsToRestore.length === 0) {
      console.log('No tabs to restore');
      
      // 检查是否使用了现有窗口
      if (useExistingWindow) {
        console.log('Used existing window, no action needed');
      } else {
        // 只有在创建了新窗口且不是唯一窗口时才关闭
        try {
          const allWindows = await chrome.windows.getAll();
          console.log('Total windows after restore attempt:', allWindows.length);
          
          if (allWindows.length > 1) {
            console.log('Multiple windows exist, safe to close empty window');
            await chrome.windows.remove(newWindow.id);
          } else {
            console.log('Only one window exists, keeping it to prevent browser exit');
            // 如果是唯一窗口，至少确保有一个标签页
            const tabs = await chrome.tabs.query({ windowId: newWindow.id });
            if (tabs.length === 0) {
              console.log('Creating a new tab to prevent empty window');
              await chrome.tabs.create({ 
                windowId: newWindow.id, 
                url: 'chrome://newtab/' 
              });
            }
          }
        } catch (error) {
          console.error('Error handling empty restore window:', error);
          // 如果出错，至少确保窗口有内容
          try {
            const tabs = await chrome.tabs.query({ windowId: newWindow.id });
            if (tabs.length === 0) {
              await chrome.tabs.create({ 
                windowId: newWindow.id, 
                url: 'chrome://newtab/' 
              });
            }
          } catch (tabError) {
            console.error('Failed to create fallback tab:', tabError);
          }
        }
      }
      
      if (skippedTabs > 0) {
        return { 
          tabsCount: 0, 
          skippedCount: skippedTabs,
          message: chrome.i18n.getMessage('allTabsAlreadyOpen') 
        };
      } else {
        return {
          tabsCount: 0,
          skippedCount: 0,
          message: chrome.i18n.getMessage('noValidTabs')
        };
      }
    }
    
    // 创建标签页的映射，用于后续分组
    const tabIdMapping = new Map(); // 原始标签ID -> 新标签ID
    let defaultTabRemoved = false;
    
    // 根据恢复模式选择批处理大小和延迟
    let batchSize, batchDelay;
    if (mode === 'performance') {
      batchSize = 2; // 性能友好模式：较小批次
      batchDelay = 800; // 延迟800毫秒
      console.log('Using performance-friendly mode: smaller batches with delay');
    } else {
      batchSize = 5; // 快速模式：较大批次
      batchDelay = 100; // 最小延迟
      console.log('Using fast mode: larger batches with minimal delay');
    }
    
    // 分批创建标签页
    for (let i = 0; i < tabsToRestore.length; i += batchSize) {
      const batch = tabsToRestore.slice(i, i + batchSize);
      
      for (let j = 0; j < batch.length; j++) {
        const tab = batch[j];
        try {
          // 验证窗口仍然存在
          console.log(`Verifying window ${newWindow.id} before creating tab ${j + 1}/${batch.length}`);
          await chrome.windows.get(newWindow.id);
          
          console.log(`Creating tab: ${tab.title} in window ${newWindow.id}`);
          const newTab = await chrome.tabs.create({
            windowId: newWindow.id,
            url: tab.url,
            pinned: tab.pinned || false,
            active: i === 0 && j === 0  // 激活第一个标签页
          });
          
          console.log(`Successfully created tab ${newTab.id} for: ${tab.title}`);
          
          // 在创建第一个标签页后移除默认标签页
          if (!defaultTabRemoved && totalTabsRestored === 0 && defaultTabsToRemove.length > 0) {
            try {
              console.log('Removing default tabs after first tab creation...');
              for (const tabToRemove of defaultTabsToRemove) {
                try {
                  // 确保不移除刚创建的标签页
                  if (tabToRemove.id !== newTab.id) {
                    console.log('Removing default tab:', tabToRemove.id);
                    await chrome.tabs.remove(tabToRemove.id);
                  }
                } catch (removeError) {
                  console.log('Failed to remove default tab:', tabToRemove.id, removeError);
                }
              }
              defaultTabRemoved = true;
            } catch (error) {
              console.log('Failed to remove default tabs:', error);
            }
          }
          
          // 记录标签页映射
          if (tab.id) {
            tabIdMapping.set(tab.id, newTab.id);
          }
          
          totalTabsRestored++;
          
          // 添加小延迟避免过快创建
          if (j < batch.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
        } catch (error) {
          if (error.message.includes('No window with id')) {
            console.error(`Window ${newWindow.id} no longer exists during tab creation`);
            console.error('Error details:', error);
            throw new Error(chrome.i18n.getMessage('loadingFailed'));
          }
          console.error(`Failed to create tab for URL: ${tab.url}`, error);
        }
      }
      
      // 添加批次间延迟
      if (i + batchSize < tabsToRestore.length) {
        console.log(`Completed batch ${Math.floor(i/batchSize) + 1}, waiting ${batchDelay}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, batchDelay));
      }
    }
    
    // 等待所有标签页创建完成后再处理分组
    console.log('Waiting before processing groups...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 验证窗口在分组前仍然存在
    try {
      await chrome.windows.get(newWindow.id);
      console.log('Window still exists before grouping');
    } catch (error) {
      console.error('Window no longer exists before grouping:', error);
      throw new Error(chrome.i18n.getMessage('loadingFailed'));
    }
    
    // 恢复分组
    console.log('Starting tab groups restoration...');
    await restoreTabGroups(newWindow.id, groupsToRestore, tabIdMapping, tabsToRestore);
    
    console.log(`Successfully restored ${totalTabsRestored} tabs, skipped ${skippedTabs} already open tabs`);
    return { 
      tabsCount: totalTabsRestored, 
      skippedCount: skippedTabs,
      message: skippedTabs > 0 ? chrome.i18n.getMessage('restoreSuccess', [totalTabsRestored.toString()]) : null
    };
    
  } catch (error) {
    console.error('❌ Failed to restore snapshot:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // 返回错误信息而不是抛出异常
    return {
      success: false,
      error: true,
      message: error.message || 'Restore failed due to unexpected error',
      tabsCount: 0,
      skippedCount: 0
    };
  }
}

// 恢复标签页分组
async function restoreTabGroups(windowId, groupsToRestore, tabIdMapping, restoredTabs) {
  console.log('Restoring tab groups...');
  
  try {
    // 验证窗口仍然存在
    await chrome.windows.get(windowId);
    
    // 获取当前窗口的所有标签页
    const currentTabs = await chrome.tabs.query({ windowId: windowId });
    
    // 为每个要恢复的分组创建新的分组
    for (const [originalGroupId, groupInfo] of Object.entries(groupsToRestore)) {
      try {
        // 找到属于此分组且实际被恢复的标签页ID
        const tabIdsForGroup = [];
        
        groupInfo.tabs.forEach(originalTab => {
          // 通过URL匹配找到对应的新标签页（只有在实际恢复的标签页中查找）
          const wasRestored = restoredTabs.some(tab => tab.url === originalTab.url);
          if (wasRestored) {
            const matchingTab = currentTabs.find(tab => tab.url === originalTab.url);
            if (matchingTab) {
              tabIdsForGroup.push(matchingTab.id);
            }
          }
        });
        
        // 只有当分组中有实际恢复的标签页时才创建分组
        if (tabIdsForGroup.length > 0) {
          // 验证所有标签页ID仍然有效
          const validTabIds = [];
          for (const tabId of tabIdsForGroup) {
            try {
              await chrome.tabs.get(tabId);
              validTabIds.push(tabId);
            } catch (error) {
              console.log(`Tab ${tabId} no longer exists, skipping`);
            }
          }
          
          if (validTabIds.length > 0) {
            // 创建新的标签页分组
            const newGroupId = await chrome.tabs.group({
              tabIds: validTabIds
            });
            
            // 设置分组属性
            await chrome.tabGroups.update(newGroupId, {
              title: groupInfo.title || chrome.i18n.getMessage('unnamedGroup'),
              color: groupInfo.color || 'grey'
            });
          
            const originalTabCount = groupInfo.tabs.length;
            const restoredTabCount = validTabIds.length;
            console.log(`Created group: "${groupInfo.title}" with ${restoredTabCount}/${originalTabCount} tabs`);
            
            if (restoredTabCount < originalTabCount) {
              console.log(`Note: ${originalTabCount - restoredTabCount} tabs from this group were already open`);
            }
          } else {
            console.log(`Skipped group "${groupInfo.title}" - no valid tabs to group`);
          }
        } else {
          console.log(`Skipped group "${groupInfo.title}" - all tabs were already open`);
        }
        
      } catch (error) {
        console.error(`Failed to restore group ${originalGroupId}:`, error);
      }
    }
    
    // 处理未分组的标签页（保持未分组状态）
    console.log('Tab groups restoration completed');
    
  } catch (error) {
    console.error('Failed to restore tab groups:', error);
    // 即使分组失败，标签页恢复仍然成功
  }
}

// 估算标签页内存占用（基于经验值）
function estimateTabMemoryUsage(tabs) {
  if (!tabs || !Array.isArray(tabs)) return 0;
  
  let totalMemory = 0;
  
  tabs.forEach(tab => {
    // 基础内存占用
    let tabMemory = 50; // 基础 50MB per tab
    
    // 根据网站类型调整内存估算
    try {
      const url = new URL(tab.url);
      const domain = url.hostname.toLowerCase();
      
      // 高内存占用网站
      if (domain.includes('youtube.com') || domain.includes('netflix.com') || domain.includes('twitch.tv')) {
        tabMemory = 150; // 视频网站
      } else if (domain.includes('gmail.com') || domain.includes('outlook.com')) {
        tabMemory = 80; // 邮件客户端
      } else if (domain.includes('docs.google.com') || domain.includes('office.com')) {
        tabMemory = 120; // 在线办公
      } else if (domain.includes('figma.com') || domain.includes('canva.com')) {
        tabMemory = 200; // 设计工具
      } else if (domain.includes('github.com') || domain.includes('gitlab.com')) {
        tabMemory = 70; // 代码托管
      } else if (domain.includes('facebook.com') || domain.includes('twitter.com') || domain.includes('instagram.com')) {
        tabMemory = 90; // 社交媒体
      }
      
    } catch (error) {
      // URL解析失败，使用默认值
    }
    
    // 如果标签页有详细描述，说明内容较丰富，略微增加内存估算
    if (tab.description && tab.description.length > 100) {
      tabMemory += 10;
    }
    
    totalMemory += tabMemory;
  });
  
  return Math.round(totalMemory);
}

// 格式化内存大小显示
function formatMemorySize(megabytes) {
  if (megabytes < 1024) {
    return megabytes + ' MB';
  } else {
    return (megabytes / 1024).toFixed(1) + ' GB';
  }
}

// 获取内存使用情况的显示文本
function getMemoryUsageText(tabCount, memoryMB) {
  const isZhCN = chrome.i18n.getUILanguage().startsWith('zh');
  const memoryText = formatMemorySize(memoryMB);
  
  if (isZhCN) {
    return `${tabCount} 个标签页 · 预计占用 ${memoryText}`;
  } else {
    return `${tabCount} tabs · ~${memoryText}`;
  }
}

// 设置为主页功能（添加书签）
async function setHomepage(url) {
  console.log('Instructing user to set homepage:', url);
  
  try {
    // Chrome扩展无法直接设置浏览器的默认主页
    // 我们返回指令让前端指导用户手动设置
    return { 
      instructUser: true,
      url: url
    };
  } catch (error) {
    console.error('Failed to prepare homepage setting:', error);
    throw new Error(chrome.i18n.getMessage('homepageSetFailed'));
  }
}

// 生成Favicon URL，使用多重备选方案
function generateFaviconUrl(url) {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    
    // 多重备选方案
    const faviconUrls = [
      `https://www.google.com/s2/favicons?sz=64&domain=${domain}`, // Google Favicon服务
      `https://favicon.yandex.net/favicon/${domain}`, // Yandex Favicon服务
      `${urlObj.protocol}//${domain}/favicon.ico`, // 标准favicon路径
      `chrome://favicon/${url}`, // Chrome内置favicon服务
    ];
    
    return faviconUrls;
  } catch (error) {
    console.warn('Failed to generate favicon URL for:', url);
    return ['data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="%23999" d="M2 3a1 1 0 011-1h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3z"/></svg>'];
  }
}

// 生成历史记录快照
async function generateHistorySnapshot() {
  console.log('Generating history snapshot...');
  
  try {
    // 检查是否有历史记录权限
    if (!chrome.history) {
      throw new Error('Chrome history API not available');
    }
    
    console.log('Requesting browser history...');
    
    // 获取浏览器历史记录（最近90天，最多1000条）
    const historyItems = await chrome.history.search({
      text: '',
      maxResults: 1000,
      startTime: Date.now() - (90 * 24 * 60 * 60 * 1000) // 90天前
    });
    
    console.log('Found history items:', historyItems.length);
    
    // 按访问次数排序，取前100个
    const sortedHistory = historyItems
      .filter(item => 
        item.url && 
        item.title &&
        !item.url.startsWith('chrome://') && 
        !item.url.startsWith('chrome-extension://') &&
        !item.url.startsWith('moz-extension://') &&
        item.visitCount > 0
      )
      .sort((a, b) => b.visitCount - a.visitCount)
      .slice(0, 100);
    
    console.log('Top 100 most visited sites:', sortedHistory.length);
    
    // 创建历史快照数据
    const historySnapshotData = {
      timestamp: Date.now(),
      type: 'history',
      totalSites: sortedHistory.length,
      sites: sortedHistory.map(item => ({
        id: `history_${Math.random().toString(36).substr(2, 9)}`,
        url: item.url,
        title: item.title,
        visitCount: item.visitCount,
        lastVisitTime: item.lastVisitTime,
        favIconUrl: generateFaviconUrl(item.url)
      }))
    };
    
    // 生成HTML页面
    const historySnapshotHTML = await generateHistorySnapshotHTML(historySnapshotData);
    
    // 保存到存储
    await chrome.storage.local.set({
      historySnapshot: historySnapshotData,
      historySnapshotHtml: historySnapshotHTML
    });
    
    // 创建数据URL（直接使用base64编码）
    const base64Html = btoa(unescape(encodeURIComponent(historySnapshotHTML)));
    const dataUrl = `data:text/html;charset=utf-8;base64,${base64Html}`;
    
    return { url: dataUrl };
    
  } catch (error) {
    console.error('Generate history snapshot failed:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    
    // 提供更具体的错误信息
    if (error.message.includes('history')) {
      throw new Error(chrome.i18n.getMessage('cannotAccessHistory'));
    } else if (error.message.includes('storage')) {
      throw new Error(chrome.i18n.getMessage('saveHistorySnapshotFailed'));
    } else {
      throw new Error(`历史分析失败: ${error.message}`);
    }
  }
}

// 获取图标作为base64编码
async function getIconAsBase64(iconPath) {
  try {
    const response = await fetch(chrome.runtime.getURL(iconPath));
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch (error) {
    console.warn('Failed to load icon:', iconPath, error);
    return '';
  }
}

// 生成历史快照HTML
async function generateHistorySnapshotHTML(historyData) {
  const isZhCN = chrome.i18n.getUILanguage().startsWith('zh');
  const date = new Date(historyData.timestamp).toLocaleString();
  
  // 预先获取图标的base64编码
  const icon16 = await getIconAsBase64('icons/icon16.png');
  const icon32 = await getIconAsBase64('icons/icon32.png');
  const icon48 = await getIconAsBase64('icons/icon48.png');
  
  let html = `
<!DOCTYPE html>
<html lang="${isZhCN ? 'zh-CN' : 'en'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${chrome.i18n.getMessage('historySnapshotTitle')} - ${chrome.i18n.getMessage('extensionName')}</title>
    <link rel="icon" type="image/png" sizes="16x16" href="data:image/png;base64,${icon16}">
    <link rel="icon" type="image/png" sizes="32x32" href="data:image/png;base64,${icon32}">
    <link rel="icon" type="image/png" sizes="48x48" href="data:image/png;base64,${icon48}">
    <style>
        * {
            box-sizing: border-box;
        }
        
        body {
            margin: 0;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, 
                #667eea 0%, 
                #764ba2 25%, 
                #f093fb 50%, 
                #f5576c 75%, 
                #4facfe 100%
            );
            background-size: 400% 400%;
            animation: gradientShift 20s ease infinite;
            min-height: 100vh;
            color: #2c3e50;
        }
        
        @keyframes gradientShift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            border-radius: 20px;
            box-shadow: 
                0 20px 60px rgba(102, 126, 234, 0.15),
                0 10px 30px rgba(139, 92, 246, 0.1),
                inset 0 1px 0 rgba(255, 255, 255, 0.8);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, 
                rgba(102, 126, 234, 0.9) 0%, 
                rgba(118, 75, 162, 0.9) 100%);
            color: white;
            padding: 32px;
            text-align: center;
        }
        
        .header h1 {
            margin: 0 0 12px 0;
            font-size: 2.2em;
            font-weight: 300;
            text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        }
        
        .header-stats {
            display: flex;
            justify-content: center;
            gap: 30px;
            margin-top: 20px;
            flex-wrap: wrap;
        }
        
        .header-stat {
            background: rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(10px);
            padding: 12px 20px;
            border-radius: 12px;
            font-size: 0.9em;
            border: 1px solid rgba(255, 255, 255, 0.3);
        }
        
        .header-stat-number {
            font-weight: 700;
            font-size: 1.2em;
        }
        
        .content {
            padding: 30px;
        }
        
        .sites-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 12px;
            margin-top: 20px;
        }
        
        .site-card {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 10px;
            padding: 12px;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            border: 1px solid rgba(255,255,255,0.3);
            position: relative;
            overflow: hidden;
            box-shadow: 0 4px 16px rgba(31, 38, 135, 0.1);
            min-height: 80px;
        }
        
        .site-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 50%;
            background: linear-gradient(135deg, rgba(74, 108, 247, 0.05) 0%, rgba(102, 126, 234, 0.05) 100%);
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        
        .site-card:hover::before {
            opacity: 1;
        }
        
        .site-card:hover {
            transform: translateY(-8px) scale(1.02);
            box-shadow: 0 16px 40px rgba(102, 126, 234, 0.2);
            border-color: rgba(102, 126, 234, 0.3);
        }
        
        .site-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 8px;
        }
        
        .favicon {
            width: 20px;
            height: 20px;
            border-radius: 4px;
            flex-shrink: 0;
            background: #f1f5f9;
            border: 1px solid #e2e8f0;
            object-fit: cover;
            transition: all 0.2s ease;
        }
        
        .favicon:hover {
            transform: scale(1.1);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }
        
        .site-title {
            font-weight: 600;
            color: #2c3e50;
            font-size: 0.8em;
            line-height: 1.2;
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .site-stats {
            display: flex;
            justify-content: space-between;
            font-size: 0.7em;
            color: #64748b;
            margin-top: 6px;
        }
        
        .visit-count {
            font-weight: 500;
            color: #4f46e5;
        }
        
        .no-sites {
            text-align: center;
            padding: 80px 40px;
            color: #5a6c7d;
            font-size: 1.1em;
            background: rgba(255, 255, 255, 0.8);
            border-radius: 20px;
            margin: 20px 0;
        }
        
        .no-sites::before {
            content: '📊';
            display: block;
            font-size: 3em;
            margin-bottom: 20px;
            opacity: 0.5;
        }
        
        @media (max-width: 768px) {
            .container {
                margin: 10px;
                border-radius: 15px;
            }
            
            .header {
                padding: 20px;
            }
            
            .header h1 {
                font-size: 1.6em;
            }
            
            .content {
                padding: 20px;
            }
            
            .sites-grid {
                grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
                gap: 10px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${chrome.i18n.getMessage('historySnapshotTitle')}</h1>
            <p>${isZhCN ? '按访问次数排序的前100个最常访问网站' : 'Top 100 most visited websites sorted by visit count'}</p>
            <div class="header-stats">
                <div class="header-stat">
                    <span class="header-stat-number">${historyData.totalSites}</span>
                    ${isZhCN ? ' 个网站' : ' websites'}
                </div>
                <div class="header-stat">
                    ${isZhCN ? '生成时间: ' : 'Generated: '}${date}
                </div>
            </div>
        </div>
        
        <div class="content">`;

  if (historyData.sites.length === 0) {
    html += `<div class="no-sites">${isZhCN ? '没有找到访问历史记录' : 'No browsing history found'}</div>`;
  } else {
    html += '<div class="sites-grid">';
    
    historyData.sites.forEach((site, index) => {
      const lastVisit = new Date(site.lastVisitTime).toLocaleDateString();
      const faviconUrls = Array.isArray(site.favIconUrl) ? site.favIconUrl : [site.favIconUrl];
      const primaryFavicon = faviconUrls[0] || '';
      const siteId = `site-${index}`;
      
      // 将favicon URLs存储在window对象中避免JSON字符串问题
      html += `<script>window.faviconUrls_${index} = ${JSON.stringify(faviconUrls)};</script>`;
      
      html += `
        <div class="site-card" onclick="window.open('${site.url.replace(/'/g, "\\'")}', '_blank')">
          <div class="site-header">
            <img class="favicon" id="${siteId}" src="${primaryFavicon}" alt="网站图标" onerror="handleFaviconError('${siteId}', ${index})" loading="lazy">
            <div class="site-title">${site.title.replace(/'/g, "&#39;").replace(/"/g, "&quot;")}</div>
          </div>
          <div class="site-stats">
            <span class="visit-count">${site.visitCount} ${isZhCN ? '次访问' : 'visits'}</span>
            <span>${isZhCN ? '最后访问: ' : 'Last: '}${lastVisit}</span>
          </div>
        </div>
      `;
    });
    
    html += '</div>';
  }

  html += `
        </div>
    </div>
    <script>
    function handleFaviconError(siteId, urlIndex) {
      const img = document.getElementById(siteId);
      if (!img) return;
      
      const faviconUrls = window['faviconUrls_' + urlIndex];
      if (!faviconUrls) return;
      
      const currentIndex = parseInt(img.dataset.currentIndex || '0');
      const nextIndex = currentIndex + 1;
      
      if (nextIndex < faviconUrls.length) {
        img.dataset.currentIndex = nextIndex;
        img.src = faviconUrls[nextIndex];
      } else {
        // 使用默认图标
        img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="%23666" d="M2 3a1 1 0 011-1h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3z"/></svg>';
        img.onerror = null; // 停止错误处理
      }
    }
    </script>
</body>
</html>
  `;

  return html;
}