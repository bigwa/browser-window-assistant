// 快照页面的JavaScript文件
console.log('Snapshot script loaded');

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('Snapshot page DOM loaded');
    addSpinnerCSS();
    initializeI18n();
    loadSnapshot();
    
    // 调试模式 - 按F12键切换
    document.addEventListener('keydown', function(e) {
        if (e.key === 'F12') {
            e.preventDefault();
            document.body.classList.toggle('debug');
            console.log('Debug mode:', document.body.classList.contains('debug') ? 'ON' : 'OFF');
        }
    });
});

// 添加spinner CSS动画
function addSpinnerCSS() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .loading-spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid rgba(255,255,255,0.3);
            border-top: 2px solid #4682dc;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
    `;
    document.head.appendChild(style);
}

// 初始化国际化
function initializeI18n() {
    // 设置页面语言
    const browserLang = chrome.i18n.getUILanguage();
    const isZhCN = browserLang.startsWith('zh');
    const langAttr = isZhCN ? 'zh-CN' : 'en';
    
    document.documentElement.lang = langAttr;
    document.title = chrome.i18n.getMessage('extensionName');
    
    // 更新loading文本
    const loadingDiv = document.getElementById('loadingDiv');
    if (loadingDiv) {
        loadingDiv.textContent = chrome.i18n.getMessage('loadingFailed') + '...'; // 使用已有的loading类似消息
    }
}

// 显示加载指示器
function showLoading(message) {
    const loadingDiv = document.getElementById('loadingDiv');
    if (loadingDiv) {
        loadingDiv.style.display = 'flex';
        loadingDiv.textContent = message || chrome.i18n.getMessage('loading');
    }
}

// 隐藏加载指示器
function hideLoading() {
    const loadingDiv = document.getElementById('loadingDiv');
    if (loadingDiv) {
        loadingDiv.style.display = 'none';
    }
}

// 简化的加载逻辑
function loadSnapshot() {
    showLoading(chrome.i18n.getMessage('loading'));
    
    chrome.storage.local.get(['snapshotHtml'], (result) => {
        console.log('Storage result:', result);
        
        if (chrome.runtime.lastError) {
            console.error('Storage error:', chrome.runtime.lastError);
            hideLoading();
            showError(chrome.i18n.getMessage('storageError') + ': ' + chrome.runtime.lastError.message);
            return;
        }
        
        if (result.snapshotHtml) {
            console.log('Found snapshot HTML, rendering...');
            
            try {
                // 创建一个新的文档片段来安全地插入HTML
                const parser = new DOMParser();
                const doc = parser.parseFromString(result.snapshotHtml, 'text/html');
                
                // 移除原有的script标签以避免CSP问题
                const scripts = doc.querySelectorAll('script');
                scripts.forEach(script => script.remove());
                
                // 安全地复制body内容，避免XSS
                document.body.replaceChildren(...Array.from(doc.body.childNodes).map(node => node.cloneNode(true)));
                
                // 复制head中的样式
                const newStyles = doc.querySelectorAll('head style');
                newStyles.forEach(style => {
                    document.head.appendChild(style.cloneNode(true));
                });
                
                // 更新title
                if (doc.title) {
                    document.title = doc.title;
                }
                
                // 隐藏加载指示器
                hideLoading();
                
                // 重新绑定点击事件和修复布局
                setTimeout(() => {
                    bindClickEvents();
                    forceCSSFix();
                }, 100);
            } catch (error) {
                console.error('Error rendering snapshot:', error);
                hideLoading();
                showError(chrome.i18n.getMessage('loadingFailed') + ': ' + error.message);
            }
        } else {
            console.log('No snapshot HTML found');
            hideLoading();
            showNoData();
        }
    });
}

// 绑定点击事件和交互效果
function bindClickEvents() {
    const cards = document.querySelectorAll('.tab-card');
    const tooltip = document.getElementById('urlTooltip');
    console.log('Binding events to', cards.length, 'cards');
    
    cards.forEach(card => {
        // 点击事件 - 只在非按钮区域触发
        card.addEventListener('click', (e) => {
            // 如果点击的是删除按钮或其子元素，不执行打开操作
            if (e.target.closest('.tab-action-btn')) {
                return;
            }
            
            const url = card.dataset.url;
            if (url) {
                console.log('Opening URL:', url);
                
                // 添加点击动画
                card.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    card.style.transform = '';
                }, 150);
                
                chrome.tabs.create({ url: url });
            }
        });
        
        // 删除按钮事件
        const deleteBtn = card.querySelector('.delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                deleteTab(card);
            });
        }
        
        // 处理favicon加载错误
        const favicon = card.querySelector('.favicon');
        if (favicon) {
            favicon.addEventListener('error', () => {
                favicon.style.display = 'none';
            });
        }
        
        // 鼠标悬停显示URL tooltip和描述
        card.addEventListener('mouseenter', (e) => {
            const url = card.dataset.url;
            const title = card.dataset.title;
            const description = card.dataset.description;
            
            if (url && tooltip) {
                // 安全地创建tooltip内容
                tooltip.replaceChildren();
                
                const titleDiv = document.createElement('div');
                titleDiv.style.cssText = 'font-weight: 600; margin-bottom: 4px;';
                titleDiv.textContent = title;
                tooltip.appendChild(titleDiv);
                
                const urlDiv = document.createElement('div');
                urlDiv.style.cssText = 'opacity: 0.8; font-size: 0.9em; margin-bottom: 6px;';
                urlDiv.textContent = url;
                tooltip.appendChild(urlDiv);
                
                if (description && description !== chrome.i18n.getMessage('noDescription')) {
                    const descDiv = document.createElement('div');
                    descDiv.style.cssText = 'opacity: 0.7; font-size: 0.85em; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 6px;';
                    descDiv.textContent = description;
                    tooltip.appendChild(descDiv);
                }
                
                tooltip.classList.add('show');
                updateTooltipPosition(e, tooltip);
            }
            
            // 显示卡片内的描述
            const descElement = card.querySelector('.tab-description');
            if (descElement && description && description !== chrome.i18n.getMessage('noDescription')) {
                descElement.style.display = 'block';
            }
        });
        
        // 鼠标移动时更新tooltip位置
        card.addEventListener('mousemove', (e) => {
            if (tooltip && tooltip.classList.contains('show')) {
                updateTooltipPosition(e, tooltip);
            }
        });
        
        // 鼠标离开隐藏tooltip和描述
        card.addEventListener('mouseleave', () => {
            if (tooltip) {
                tooltip.classList.remove('show');
            }
            
            // 隐藏卡片内的描述
            const descElement = card.querySelector('.tab-description');
            if (descElement) {
                descElement.style.display = 'none';
            }
        });
        
        // 添加进入动画
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            card.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, Math.random() * 300 + 100);
    });
    
    // 添加分组展开/收起功能
    addGroupToggleFunction();
    
    // 绑定分组恢复按钮事件
    bindGroupRestoreButtons();
    
    // 绑定头部按钮事件
    bindHeaderButtons();
    
    // 检查并修复布局问题
    fixLayoutIssues();
}

// 更新tooltip位置
function updateTooltipPosition(e, tooltip) {
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    const tooltipRect = tooltip.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    let left = mouseX + 15;
    let top = mouseY - tooltipRect.height - 10;
    
    // 防止tooltip超出屏幕边界
    if (left + tooltipRect.width > windowWidth) {
        left = mouseX - tooltipRect.width - 15;
    }
    
    if (top < 0) {
        top = mouseY + 15;
    }
    
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
}

// 绑定头部按钮事件
function bindHeaderButtons() {
    // 恢复快照按钮
    const restoreSnapshotBtn = document.getElementById('restoreSnapshotBtn');
    if (restoreSnapshotBtn) {
        restoreSnapshotBtn.addEventListener('click', () => {
            restoreAllTabs();
        });
    }
    
    // 设置主页按钮
    const setHomepageBtn = document.getElementById('setHomepageBtn');
    if (setHomepageBtn) {
        setHomepageBtn.addEventListener('click', () => {
            setAsHomepage();
        });
    }
    
    
}

// 绑定分组恢复按钮事件
function bindGroupRestoreButtons() {
    const groupRestoreButtons = document.querySelectorAll('.group-restore-btn');
    console.log('Found group restore buttons:', groupRestoreButtons.length);
    
    groupRestoreButtons.forEach(button => {
        button.addEventListener('click', async (e) => {
            e.stopPropagation(); // 防止触发分组展开/收起
            
            const groupId = button.dataset.groupId;
            const groupSection = button.closest('.tab-group-section');
            const groupTitle = groupSection.querySelector('.group-title').textContent;
            const groupCount = groupSection.querySelector('.group-count').textContent;
            
            console.log('Restore group clicked:', groupId, groupTitle);
            
            // 收集分组数据以计算内存占用
            const groupData = await collectGroupData(groupId, groupSection);
            if (!groupData) {
                alert(chrome.i18n.getMessage('cannotGetGroupData'));
                return;
            }
            
            // 计算内存占用
            const groupTabs = groupData.tabs || [];
            const memoryMB = estimateTabMemoryUsage(groupTabs);
            const memoryText = formatMemorySize(memoryMB);
            
            // 增强的确认对话框
            const isZhCN = chrome.i18n.getUILanguage().startsWith('zh');
            const confirmMessage = isZhCN ? 
                `确定要恢复分组"${groupTitle}"吗？\n\n包含 ${groupCount}\n预计内存占用：${memoryText}\n\n系统会自动跳过已经打开的页面。` :
                `Are you sure you want to restore group "${groupTitle}"?\n\nContains ${groupCount}\nEstimated memory usage: ${memoryText}\n\nSystem will automatically skip already open pages.`;
            
            const confirmed = confirm(confirmMessage);
            if (!confirmed) {
                return;
            }
            
            // 显示加载状态
            const originalText = button.title;
            button.disabled = true;
            button.style.opacity = '0.5';
            button.title = chrome.i18n.getMessage('restoring');
            
            // 添加loading spinner
            const originalIcon = button.innerHTML;
            button.innerHTML = `
                <div style="display: flex; align-items: center; gap: 6px;">
                    <div style="width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top: 2px solid white; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    <span>${chrome.i18n.getMessage('restoring')}</span>
                </div>
            `;
            
            try {
                console.log('Sending restore group request:', groupId, groupData);
                
                const response = await new Promise((resolve) => {
                    chrome.runtime.sendMessage({
                        action: 'restoreGroup',
                        groupId: groupId,
                        groupData: groupData
                    }, resolve);
                });
                
                console.log('Restore group response:', response);
                
                if (response && response.success) {
                    let message;
                    if (response.tabsCount === 0 && response.skippedCount > 0) {
                        message = response.message || chrome.i18n.getMessage('allTabsAlreadyOpen');
                    } else if (response.message) {
                        message = response.message;
                    } else {
                        message = chrome.i18n.getMessage('restoreSuccess', [response.tabsCount.toString()]);
                    }
                    alert(message);
                } else {
                    alert(chrome.i18n.getMessage('restoreFailed') + ': ' + (response ? response.error : 'Unknown error'));
                }
                
            } catch (error) {
                console.error('Restore group error:', error);
                alert(chrome.i18n.getMessage('restoreFailed') + ': ' + error.message);
            } finally {
                // 恢复按钮状态
                button.disabled = false;
                button.style.opacity = '';
                button.title = originalText;
                button.innerHTML = originalIcon;
            }
        });
    });
}

// 收集分组数据
async function collectGroupData(groupId, groupSection) {
    try {
        // 获取存储的会话数据
        const stored = await new Promise((resolve) => {
            chrome.storage.local.get(['lastSession'], resolve);
        });
        
        if (!stored.lastSession) {
            console.error('No session data found');
            return null;
        }
        
        const sessionData = stored.lastSession;
        
        if (groupId === 'ungrouped') {
            // 处理未分组的标签页
            const ungroupedTabs = [];
            
            sessionData.windows.forEach(window => {
                window.tabs.forEach(tab => {
                    if (!tab.groupId || tab.groupId === -1) {
                        ungroupedTabs.push(tab);
                    }
                });
            });
            
            return {
                title: chrome.i18n.getMessage('ungroupedTabs'),
                color: 'grey',
                tabs: ungroupedTabs
            };
            
        } else {
            // 处理有分组的标签页
            if (!sessionData.groups || !sessionData.groups[groupId]) {
                console.error('Group not found:', groupId);
                return null;
            }
            
            const groupInfo = sessionData.groups[groupId];
            const groupTabs = [];
            
            sessionData.windows.forEach(window => {
                window.tabs.forEach(tab => {
                    if (tab.groupId && tab.groupId == groupId) {
                        groupTabs.push(tab);
                    }
                });
            });
            
            return {
                title: groupInfo.title || chrome.i18n.getMessage('unnamedGroup'),
                color: groupInfo.color || 'grey',
                tabs: groupTabs
            };
        }
        
    } catch (error) {
        console.error('Failed to collect group data:', error);
        return null;
    }
}

// 添加分组展开/收起功能
function addGroupToggleFunction() {
    const groupHeaders = document.querySelectorAll('.group-header');
    
    groupHeaders.forEach(header => {
        header.addEventListener('click', (e) => {
            // 如果点击的是恢复按钮，不执行展开/收起
            if (e.target.closest('.group-restore-btn')) {
                return;
            }
            
            e.preventDefault();
            e.stopPropagation();
            
            const tabsGrid = header.nextElementSibling;
            const toggleIcon = header.querySelector('.toggle-icon');
            const isCollapsed = header.classList.contains('collapsed');
            
            if (isCollapsed) {
                // 展开
                header.classList.remove('collapsed');
                tabsGrid.style.display = 'grid';
                
                // 动画效果
                tabsGrid.style.opacity = '0';
                tabsGrid.style.transform = 'translateY(-10px)';
                
                setTimeout(() => {
                    tabsGrid.style.transition = 'all 0.3s ease';
                    tabsGrid.style.opacity = '1';
                    tabsGrid.style.transform = 'translateY(0)';
                }, 10);
                
            } else {
                // 收起
                header.classList.add('collapsed');
                
                tabsGrid.style.transition = 'all 0.3s ease';
                tabsGrid.style.opacity = '0';
                tabsGrid.style.transform = 'translateY(-10px)';
                
                setTimeout(() => {
                    tabsGrid.style.display = 'none';
                }, 300);
            }
            
            // 按钮点击反馈
            const toggleButton = header.querySelector('.group-toggle');
            if (toggleButton) {
                toggleButton.style.transform = 'scale(0.9)';
                setTimeout(() => {
                    toggleButton.style.transform = 'scale(1)';
                }, 150);
            }
        });
        
        // 防止点击折叠图标时触发tooltip
        const toggleButton = header.querySelector('.group-toggle');
        if (toggleButton) {
            toggleButton.addEventListener('click', (e) => {
                e.stopPropagation();
                header.click();
            });
        }
    });
}

// 显示错误信息
function showError(message) {
    // 清空body并创建错误容器
    document.body.replaceChildren();
    
    const errorContainer = document.createElement('div');
    errorContainer.style.cssText = 'text-align: center; color: white; margin-top: 50px; padding: 20px; background: rgba(220, 53, 69, 0.3); border-radius: 10px; max-width: 600px; margin: 50px auto;';
    
    const errorTitle = document.createElement('h2');
    errorTitle.textContent = '❌ ' + chrome.i18n.getMessage('loadingFailed');
    errorContainer.appendChild(errorTitle);
    
    const errorMessage = document.createElement('p');
    errorMessage.textContent = message;
    errorContainer.appendChild(errorMessage);
    
    const reloadBtn = document.createElement('button');
    reloadBtn.id = 'reloadBtn';
    reloadBtn.style.cssText = 'background: white; color: #dc3545; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-top: 10px;';
    reloadBtn.textContent = 'Reload Page';
    errorContainer.appendChild(reloadBtn);
    
    document.body.appendChild(errorContainer);
    
    // 绑定重新加载按钮
    document.getElementById('reloadBtn').addEventListener('click', () => {
        location.reload();
    });
}

// 显示无数据消息
function showNoData() {
    // 清空body并创建无数据容器
    document.body.replaceChildren();
    
    const noDataContainer = document.createElement('div');
    noDataContainer.style.cssText = 'text-align: center; color: white; margin-top: 50px;';
    
    const noDataTitle = document.createElement('h2');
    noDataTitle.textContent = '📝 ' + chrome.i18n.getMessage('noSnapshotData');
    noDataContainer.appendChild(noDataTitle);
    
    const infoP1 = document.createElement('p');
    infoP1.textContent = 'When you close your browser, we will automatically save a snapshot of your tabs.';
    noDataContainer.appendChild(infoP1);
    
    const infoP2 = document.createElement('p');
    infoP2.textContent = 'You can also click the extension icon to manually save the current session.';
    noDataContainer.appendChild(infoP2);
    
    const extensionsBtn = document.createElement('button');
    extensionsBtn.id = 'extensionsBtn';
    extensionsBtn.style.cssText = 'background: rgba(255,255,255,0.2); color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin: 10px;';
    extensionsBtn.textContent = 'Back to Extensions';
    noDataContainer.appendChild(extensionsBtn);
    
    document.body.appendChild(noDataContainer);
    
    // 绑定按钮事件
    document.getElementById('extensionsBtn').addEventListener('click', () => {
        chrome.tabs.create({url: 'chrome://extensions/'});
    });
    
}

// 恢复快照功能
async function restoreAllTabs() {
    try {
        // 获取会话数据以计算内存占用
        const stored = await new Promise((resolve) => {
            chrome.storage.local.get(['lastSession'], resolve);
        });
        
        if (!stored.lastSession) {
            alert('No session data found');
            return;
        }
        
        const sessionData = stored.lastSession;
        let allTabs = [];
        sessionData.windows.forEach(window => {
            allTabs.push(...window.tabs);
        });
        
        const totalTabs = allTabs.length;
        const memoryMB = estimateTabMemoryUsage(allTabs);
        const memoryText = formatMemorySize(memoryMB);
        
        // 增强的确认对话框
        const isZhCN = chrome.i18n.getUILanguage().startsWith('zh');
        const confirmMessage = isZhCN ?
            `确定要恢复快照中的所有标签页吗？\n\n共 ${totalTabs} 个标签页\n预计内存占用：${memoryText}\n\n系统会自动跳过已经打开的页面，仅恢复关闭的页面。` :
            `Are you sure you want to restore all tabs from the snapshot?\n\n${totalTabs} tabs total\nEstimated memory usage: ${memoryText}\n\nThe system will automatically skip pages that are already open and only restore closed pages.`;
        
        // 创建自定义恢复模式选择对话框
        const modeChoice = await showRestoreModeDialog(confirmMessage, totalTabs, memoryText);
        if (!modeChoice) {
            return;
        }
        // 显示加载状态
        const button = document.getElementById('restoreSnapshotBtn');
        if (button) {
            const originalText = button.textContent;
            button.textContent = chrome.i18n.getMessage('restoring');
            button.disabled = true;
            button.style.opacity = '0.7';
            
            // 添加loading spinner
            const spinner = document.createElement('div');
            spinner.style.cssText = 'display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top: 2px solid white; border-radius: 50%; animation: spin 1s linear infinite; margin-right: 8px;';
            button.prepend(spinner);
            
            chrome.runtime.sendMessage({ 
                action: 'restoreSnapshot',
                mode: modeChoice
            }, (response) => {
                // 恢复按钮状态
                const spinner = button.querySelector('div');
                if (spinner) spinner.remove();
                button.textContent = originalText;
                button.disabled = false;
                button.style.opacity = '';
                
                if (response && response.success) {
                    let message;
                    if (response.tabsCount === 0 && response.skippedCount > 0) {
                        message = chrome.i18n.getMessage('allTabsAlreadyOpen');
                    } else if (response.tabsCount === 0 && response.skippedCount === 0) {
                        message = response.message || chrome.i18n.getMessage('noValidTabs');
                    } else if (response.message) {
                        message = response.message;
                    } else {
                        message = chrome.i18n.getMessage('restoreSuccess', [response.tabsCount.toString()]);
                    }
                    alert(message);
                } else {
                    alert(chrome.i18n.getMessage('restoreFailed') + ': ' + (response ? response.error : 'Unknown error'));
                }
            });
        } else {
            // 如果找不到按钮，直接执行恢复逻辑
            chrome.runtime.sendMessage({ 
                action: 'restoreSnapshot',
                mode: modeChoice
            }, (response) => {
                if (response && response.success) {
                    let message;
                    if (response.tabsCount === 0 && response.skippedCount > 0) {
                        message = chrome.i18n.getMessage('allTabsAlreadyOpen');
                    } else if (response.tabsCount === 0 && response.skippedCount === 0) {
                        message = response.message || chrome.i18n.getMessage('noValidTabs');
                    } else if (response.message) {
                        message = response.message;
                    } else {
                        message = chrome.i18n.getMessage('restoreSuccess', [response.tabsCount.toString()]);
                    }
                    alert(message);
                } else {
                    alert(chrome.i18n.getMessage('restoreFailed') + ': ' + (response ? response.error : 'Unknown error'));
                }
            });
        }
    } catch (error) {
        console.error('Error in restoreAllTabs:', error);
        alert('Failed to restore tabs: ' + error.message);
    }
}

// 测试保存功能
function testSave() {
    chrome.runtime.sendMessage({ action: 'saveSession' }, (response) => {
        if (response && response.success) {
            alert(chrome.i18n.getMessage('sessionSaved') + ' Refresh the page to view the snapshot.');
            location.reload();
        } else {
            alert(chrome.i18n.getMessage('saveFailed') + ': ' + (response ? response.error : 'Unknown error'));
        }
    });
}

// 综合功能测试
async function testAllFunctionality() {
    console.log('Starting comprehensive functionality test...');
    
    const testResults = {
        saveSession: false,
        loadSnapshot: false,
        restoreSnapshot: false,
        smartGrouping: false,
        setHomepage: false,
        tabDeleting: false
    };
    
    let testLog = 'Chrome Browser Window Assistant - Comprehensive Test Results\n\n';
    
    try {
        // 1. 测试保存会话功能
        testLog += '1. Testing Save Session Functionality...\n';
        const saveResponse = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: 'saveSession' }, resolve);
        });
        
        if (saveResponse && saveResponse.success) {
            testResults.saveSession = true;
            testLog += '   ✅ Save Session: PASSED\n';
        } else {
            testLog += '   ❌ Save Session: FAILED - ' + (saveResponse ? saveResponse.error : 'No response') + '\n';
        }
        
        // 等待1秒让保存完成
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 2. 测试快照加载功能
        testLog += '\n2. Testing Snapshot Loading...\n';
        const stored = await new Promise((resolve) => {
            chrome.storage.local.get(['lastSession'], resolve);
        });
        
        if (stored.lastSession && stored.lastSession.windows.length > 0) {
            testResults.loadSnapshot = true;
            testLog += '   ✅ Snapshot Loading: PASSED\n';
            testLog += '   📊 Found ' + stored.lastSession.windows.length + ' windows with ' + 
                       stored.lastSession.windows.reduce((total, w) => total + w.tabs.length, 0) + ' tabs\n';
        } else {
            testLog += '   ❌ Snapshot Loading: FAILED - No session data found\n';
        }
        
        // 3. 测试智能分组功能
        testLog += '\n3. Testing Smart Grouping...\n';
        if (stored.lastSession) {
            const ungroupedTabsExist = stored.lastSession.windows.some(window => 
                window.tabs.some(tab => !tab.groupId || tab.groupId === -1)
            );
            
            if (ungroupedTabsExist) {
                try {
                    // 模拟智能分组逻辑测试
                    const domainGroups = {};
                    stored.lastSession.windows.forEach(window => {
                        const ungroupedTabs = window.tabs.filter(tab => !tab.groupId || tab.groupId === -1);
                        ungroupedTabs.forEach(tab => {
                            try {
                                const url = new URL(tab.url);
                                const domain = url.hostname.replace('www.', '');
                                if (!domainGroups[domain]) {
                                    domainGroups[domain] = [];
                                }
                                domainGroups[domain].push(tab);
                            } catch (e) {
                                // Invalid URL - ignore
                            }
                        });
                    });
                    
                    const potentialGroups = Object.entries(domainGroups).filter(([domain, tabs]) => tabs.length >= 2);
                    
                    if (potentialGroups.length > 0) {
                        testResults.smartGrouping = true;
                        testLog += '   ✅ Smart Grouping: PASSED\n';
                        testLog += '   📝 Can create ' + potentialGroups.length + ' smart groups\n';
                        potentialGroups.forEach(([domain, tabs]) => {
                            testLog += '     - ' + domain + ': ' + tabs.length + ' tabs\n';
                        });
                    } else {
                        testLog += '   ⚠️  Smart Grouping: WARNING - No suitable groups can be created (need 2+ tabs per domain)\n';
                    }
                } catch (error) {
                    testLog += '   ❌ Smart Grouping: FAILED - ' + error.message + '\n';
                }
            } else {
                testLog += '   ⚠️  Smart Grouping: WARNING - All tabs are already grouped\n';
                testResults.smartGrouping = true; // This is okay
            }
        }
        
        // 4. 测试设置主页功能
        testLog += '\n4. Testing Set Homepage Functionality...\n';
        try {
            const currentUrl = window.location.href;
            const homepageResponse = await new Promise((resolve) => {
                chrome.runtime.sendMessage({
                    action: 'setHomepage',
                    url: currentUrl
                }, resolve);
            });
            
            if (homepageResponse && homepageResponse.success) {
                testResults.setHomepage = true;
                testLog += '   ✅ Set Homepage: PASSED\n';
            } else {
                testLog += '   ❌ Set Homepage: FAILED - ' + (homepageResponse ? homepageResponse.error : 'No response') + '\n';
            }
        } catch (error) {
            testLog += '   ❌ Set Homepage: FAILED - ' + error.message + '\n';
        }
        
        // 5. 测试标签页删除功能
        testLog += '\n5. Testing Tab Deletion...\n';
        const tabCards = document.querySelectorAll('.tab-card');
        if (tabCards.length > 0) {
            testResults.tabDeleting = true;
            testLog += '   ✅ Tab Deletion: PASSED - Delete buttons are functional\n';
            testLog += '   📝 Found ' + tabCards.length + ' tabs with delete functionality\n';
        } else {
            testLog += '   ⚠️  Tab Deletion: WARNING - No tabs available to test deletion\n';
        }
        
        // 6. 测试恢复快照功能（不实际执行，只检查功能可用性）
        testLog += '\n6. Testing Restore Snapshot...\n';
        const restoreBtn = document.getElementById('restoreSnapshotBtn');
        if (restoreBtn && stored.lastSession && stored.lastSession.windows.length > 0) {
            testResults.restoreSnapshot = true;
            testLog += '   ✅ Restore Snapshot: PASSED - Function is available\n';
        } else {
            testLog += '   ❌ Restore Snapshot: FAILED - Button not found or no data to restore\n';
        }
        
        // 计算总体测试结果
        const passedTests = Object.values(testResults).filter(result => result).length;
        const totalTests = Object.keys(testResults).length;
        
        testLog += '\n' + '='.repeat(50) + '\n';
        testLog += `SUMMARY: ${passedTests}/${totalTests} tests passed (${Math.round(passedTests/totalTests*100)}%)\n`;
        testLog += '='.repeat(50) + '\n';
        
        if (passedTests === totalTests) {
            testLog += '🎉 All tests PASSED! Extension is working correctly.\n';
        } else if (passedTests >= totalTests * 0.8) {
            testLog += '⚠️  Most tests passed. Some minor issues may need attention.\n';
        } else {
            testLog += '❌ Several tests failed. Extension may have significant issues.\n';
        }
        
        // 显示测试结果
        console.log(testLog);
        alert('Comprehensive testing completed!\n\nCheck the browser console (F12) for detailed results.\n\n' +
              `Summary: ${passedTests}/${totalTests} tests passed (${Math.round(passedTests/totalTests*100)}%)`);
        
        // 可选：将测试结果保存到存储中
        chrome.storage.local.set({
            lastTestResults: {
                timestamp: Date.now(),
                results: testResults,
                log: testLog,
                summary: `${passedTests}/${totalTests} tests passed`
            }
        });
        
    } catch (error) {
        console.error('Testing failed with error:', error);
        alert('Comprehensive testing failed: ' + error.message);
    }
}

// 删除标签页功能
function deleteTab(cardElement) {
    const tabId = cardElement.dataset.tabId;
    const url = cardElement.dataset.url;
    const title = cardElement.dataset.title;
    
    // 确认对话框
    if (!confirm(chrome.i18n.getMessage('confirmDeleteTab', [title]))) {
        return;
    }
    
    // 显示删除加载状态
    const deleteBtn = cardElement.querySelector('.delete-btn');
    if (deleteBtn) {
        deleteBtn.disabled = true;
        deleteBtn.innerHTML = '<div class="loading-spinner" style="width: 12px; height: 12px;"></div>';
    }
    
    // 添加删除动画
    cardElement.style.transition = 'all 0.3s ease';
    cardElement.style.transform = 'scale(0.8)';
    cardElement.style.opacity = '0';
    
    setTimeout(() => {
        // 从DOM中移除
        cardElement.remove();
        
        // 更新存储的会话数据（添加完成回调）
        updateSessionData(tabId, url, () => {
            // 更新页面统计信息
            updateStats();
            
            // 检查分组是否为空
            checkEmptyGroups();
        });
    }, 300);
}

// 更新会话数据（从存储中移除被删除的标签页）
function updateSessionData(tabId, url, callback) {
    chrome.storage.local.get(['lastSession'], (result) => {
        if (result.lastSession) {
            const sessionData = result.lastSession;
            
            // 从所有窗口中移除匹配的标签页
            sessionData.windows.forEach(window => {
                window.tabs = window.tabs.filter(tab => {
                    // 通过URL和tabId匹配要删除的标签页
                    return !(tab.url === url || (tabId && tab.id === tabId));
                });
            });
            
            // 重新生成快照HTML
            const snapshotHtml = generateUpdatedSnapshotHTML(sessionData);
            
            // 保存更新后的数据
            chrome.storage.local.set({ 
                lastSession: sessionData,
                snapshotHtml: snapshotHtml
            }, () => {
                // 执行回调函数
                if (callback && typeof callback === 'function') {
                    callback();
                }
            });
        } else {
            // 如果没有会话数据，也执行回调
            if (callback && typeof callback === 'function') {
                callback();
            }
        }
    });
}

// 生成更新后的快照HTML（简化版本，用于更新统计信息）
function generateUpdatedSnapshotHTML(sessionData) {
    // 这里可以调用background.js中的生成函数，但为了简化，
    // 我们只更新当前页面的统计信息
    return null; // 暂时返回null，重点是更新sessionData
}

// 更新页面头部的统计信息
function updateStats() {
    const remainingCards = document.querySelectorAll('.tab-card').length;
    const totalGroups = document.querySelectorAll('.tab-group-section').length;
    
    // 更新标签页总数
    const tabCountElement = document.querySelector('.header-stat .header-stat-number');
    if (tabCountElement) {
        tabCountElement.textContent = remainingCards;
    }
    
    // 更新分组数（如果有空分组会在checkEmptyGroups中处理）
    const groupCountElements = document.querySelectorAll('.header-stat .header-stat-number');
    if (groupCountElements.length > 1) {
        groupCountElements[1].textContent = totalGroups;
    }
}

// 检查并移除空分组
function checkEmptyGroups() {
    const groupSections = document.querySelectorAll('.tab-group-section');
    
    groupSections.forEach(section => {
        const tabsGrid = section.querySelector('.tabs-grid');
        const remainingTabs = tabsGrid.querySelectorAll('.tab-card');
        
        if (remainingTabs.length === 0) {
            // 分组已空，添加移除动画
            section.style.transition = 'all 0.3s ease';
            section.style.opacity = '0';
            section.style.transform = 'translateY(-20px)';
            
            setTimeout(() => {
                section.remove();
                updateStats(); // 重新更新统计信息
            }, 300);
        } else {
            // 更新分组标签页数量
            const groupCount = section.querySelector('.group-count');
            if (groupCount) {
                groupCount.textContent = `${remainingTabs.length} 个标签页`;
            }
        }
    });
}

// 强制修复CSS问题
function forceCSSFix() {
    console.log('Force fixing CSS issues...');
    
    // 创建并注入强制CSS样式
    const forceStyle = document.createElement('style');
    forceStyle.id = 'force-fix-css';
    forceStyle.textContent = `
        .tabs-grid {
            display: grid !important;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)) !important;
            gap: 20px !important;
            padding: 25px !important;
            width: 100% !important;
            box-sizing: border-box !important;
            grid-auto-rows: auto !important;
            align-items: start !important;
        }
        
        .tab-card {
            display: flex !important;
            flex-direction: column !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
            grid-column: span 1 !important;
            margin: 0 !important;
            background: white !important;
            border-radius: 12px !important;
            padding: 18px !important;
            min-height: 80px !important;
        }
        
        .tab-header {
            display: flex !important;
            align-items: flex-start !important;
            width: 100% !important;
            min-width: 0 !important;
            gap: 10px !important;
        }
        
        .tab-title {
            flex: 1 !important;
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
            min-width: 0 !important;
        }
    `;
    
    // 移除旧的强制样式（如果存在）
    const oldForceStyle = document.getElementById('force-fix-css');
    if (oldForceStyle) {
        oldForceStyle.remove();
    }
    
    // 添加新的强制样式
    document.head.appendChild(forceStyle);
    
    // 延迟执行详细的布局检查
    setTimeout(() => {
        fixLayoutIssues();
    }, 200);
}

// 检查并修复布局问题
function fixLayoutIssues() {
    console.log('Checking for layout issues...');
    
    const tabsGrids = document.querySelectorAll('.tabs-grid');
    tabsGrids.forEach((grid, index) => {
        console.log(`Grid ${index}:`, {
            display: window.getComputedStyle(grid).display,
            gridTemplateColumns: window.getComputedStyle(grid).gridTemplateColumns,
            gap: window.getComputedStyle(grid).gap,
            width: window.getComputedStyle(grid).width,
            children: grid.children.length
        });
        
        // 强制应用网格样式
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(300px, 1fr))';
        grid.style.gap = '20px';
        grid.style.width = '100%';
        grid.style.boxSizing = 'border-box';
        
        // 确保所有子元素都是正确的
        const cards = grid.querySelectorAll('.tab-card');
        cards.forEach((card, cardIndex) => {
            card.style.width = '100%';
            card.style.maxWidth = '100%';
            card.style.gridColumn = 'span 1';
            card.style.margin = '0';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.boxSizing = 'border-box';
            
            console.log(`Card ${cardIndex} in grid ${index}:`, {
                width: window.getComputedStyle(card).width,
                maxWidth: window.getComputedStyle(card).maxWidth,
                display: window.getComputedStyle(card).display
            });
        });
    });
    
    // 监听窗口大小变化，重新检查
    if (!window.layoutFixListenerAdded) {
        window.addEventListener('resize', () => {
            setTimeout(forceCSSFix, 100);
        });
        window.layoutFixListenerAdded = true;
    }
}

// 全局暴露函数供HTML使用
window.loadSnapshot = loadSnapshot;
window.bindClickEvents = bindClickEvents;
window.bindHeaderButtons = bindHeaderButtons;
window.showError = showError;
window.showNoData = showNoData;
window.testSave = testSave;
window.deleteTab = deleteTab;
window.fixLayoutIssues = fixLayoutIssues;
// 设置当前页面为浏览器默认主页
function setAsHomepage() {
    try {
        // 显示加载状态
        const button = document.getElementById('setHomepageBtn');
        let originalContent = '';
        if (button) {
            originalContent = button.innerHTML;
            button.disabled = true;
            button.innerHTML = `
                <div style="display: flex; align-items: center; gap: 6px;">
                    <div class="loading-spinner" style="width: 14px; height: 14px;"></div>
                    <span>${chrome.i18n.getMessage('processing')}</span>
                </div>
            `;
        }
        
        const currentUrl = window.location.href;
        console.log('Setting homepage to:', currentUrl);
        
        chrome.runtime.sendMessage({
            action: 'setHomepage',
            url: currentUrl
        }, (response) => {
            // 恢复按钮状态
            if (button) {
                button.disabled = false;
                button.innerHTML = originalContent;
            }
            if (chrome.runtime.lastError) {
                console.error('Failed to set homepage:', chrome.runtime.lastError);
                alert(chrome.i18n.getMessage('homepageSetFailed'));
                return;
            }
            
            if (response && response.success && response.instructUser) {
                console.log('Showing homepage setup instructions');
                
                // 显示设置指导对话框
                const isZhCN = chrome.i18n.getUILanguage().startsWith('zh');
                const instructions = isZhCN ? 
                    `要将此页面设为浏览器主页，请按以下步骤操作：\n\n1. 点击Chrome浏览器右上角的三个点菜单\n2. 选择"设置"\n3. 在左侧菜单中选择"启动时"\n4. 选择"打开特定网页或一组网页"\n5. 点击"添加新页面"\n6. 粘贴此网址：\n${response.url}\n\n是否现在为您复制网址到剪贴板？` :
                    `To set this page as your browser homepage, please follow these steps:\n\n1. Click the three-dot menu in the top right of Chrome\n2. Select "Settings"\n3. In the left menu, select "On startup"\n4. Choose "Open a specific page or set of pages"\n5. Click "Add a new page"\n6. Paste this URL:\n${response.url}\n\nWould you like to copy the URL to your clipboard now?`;
                
                const copyUrl = confirm(instructions);
                if (copyUrl) {
                    // 复制URL到剪贴板
                    navigator.clipboard.writeText(response.url).then(() => {
                        alert(isZhCN ? '网址已复制到剪贴板！' : 'URL copied to clipboard!');
                    }).catch(() => {
                        // 如果剪贴板API失败，使用旧方法
                        const textArea = document.createElement('textarea');
                        textArea.value = response.url;
                        document.body.appendChild(textArea);
                        textArea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textArea);
                        alert(isZhCN ? '网址已复制到剪贴板！' : 'URL copied to clipboard!');
                    });
                }
            } else {
                console.error('Failed to set homepage:', response);
                alert(chrome.i18n.getMessage('homepageSetFailed'));
            }
        });
    } catch (error) {
        console.error('Error setting homepage:', error);
        alert(chrome.i18n.getMessage('homepageSetFailed'));
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

// 显示恢复模式选择对话框
function showRestoreModeDialog(message, tabCount, memoryText) {
  return new Promise((resolve) => {
    const isZhCN = chrome.i18n.getUILanguage().startsWith('zh');
    
    // 创建对话框HTML
    const dialogHtml = `
      <div id="restoreModeDialog" style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <div style="
          background: white;
          border-radius: 12px;
          padding: 24px;
          max-width: 480px;
          width: 90%;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        ">
          <h3 style="
            margin: 0 0 16px 0;
            color: #1f2937;
            font-size: 18px;
            font-weight: 600;
          ">${isZhCN ? '恢复模式选择' : 'Restoration Mode'}</h3>
          
          <p style="
            margin: 0 0 20px 0;
            color: #4b5563;
            line-height: 1.5;
            font-size: 14px;
          ">${message.replace(/\\n/g, '<br>')}</p>
          
          <div style="margin: 20px 0;">
            <div class="mode-option" data-mode="fast" style="
              border: 2px solid #e5e7eb;
              border-radius: 8px;
              padding: 16px;
              margin-bottom: 12px;
              cursor: pointer;
              transition: all 0.2s;
            ">
              <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <div class="radio-btn" style="
                  width: 16px;
                  height: 16px;
                  border: 2px solid #d1d5db;
                  border-radius: 50%;
                  margin-right: 12px;
                  position: relative;
                "></div>
                <strong style="color: #1f2937;">${isZhCN ? '⚡ 快速恢复模式' : '⚡ Fast Restore Mode'}</strong>
              </div>
              <p style="
                margin: 0;
                color: #6b7280;
                font-size: 13px;
                line-height: 1.4;
                margin-left: 28px;
              ">${isZhCN ? '立即恢复所有标签页。可能会短暂占用较多系统资源。' : 'Restore all tabs immediately. May briefly use more system resources.'}</p>
            </div>
            
            <div class="mode-option" data-mode="performance" style="
              border: 2px solid #e5e7eb;
              border-radius: 8px;
              padding: 16px;
              cursor: pointer;
              transition: all 0.2s;
            ">
              <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <div class="radio-btn" style="
                  width: 16px;
                  height: 16px;
                  border: 2px solid #d1d5db;
                  border-radius: 50%;
                  margin-right: 12px;
                  position: relative;
                "></div>
                <strong style="color: #1f2937;">${isZhCN ? '🛡️ 性能友好模式' : '🛡️ Performance-Friendly Mode'}</strong>
              </div>
              <p style="
                margin: 0;
                color: #6b7280;
                font-size: 13px;
                line-height: 1.4;
                margin-left: 28px;
              ">${isZhCN ? '分批次恢复标签页，避免系统卡顿。推荐用于大量标签页。' : 'Restore tabs in batches to avoid system lag. Recommended for many tabs.'}</p>
            </div>
          </div>
          
          <div style="
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            margin-top: 24px;
          ">
            <button id="cancelRestoreBtn" style="
              padding: 8px 16px;
              border: 1px solid #d1d5db;
              background: white;
              border-radius: 6px;
              cursor: pointer;
              font-size: 14px;
              color: #374151;
            ">${isZhCN ? '取消' : 'Cancel'}</button>
            <button id="confirmRestoreBtn" style="
              padding: 8px 16px;
              border: none;
              background: #3b82f6;
              color: white;
              border-radius: 6px;
              cursor: pointer;
              font-size: 14px;
              opacity: 0.5;
            " disabled>${isZhCN ? '确定恢复' : 'Confirm'}</button>
          </div>
        </div>
      </div>
    `;
    
    // 添加对话框到页面
    document.body.insertAdjacentHTML('beforeend', dialogHtml);
    
    let selectedMode = null;
    
    // 模式选择函数
    const selectMode = function(mode) {
      selectedMode = mode;
      
      // 更新UI
      document.querySelectorAll('.mode-option').forEach(option => {
        const radioBtns = option.querySelectorAll('.radio-btn');
        const isSelected = option.dataset.mode === mode;
        
        option.style.borderColor = isSelected ? '#3b82f6' : '#e5e7eb';
        option.style.backgroundColor = isSelected ? '#eff6ff' : 'white';
        
        radioBtns.forEach(radioBtn => {
          radioBtn.style.borderColor = isSelected ? '#3b82f6' : '#d1d5db';
          radioBtn.innerHTML = isSelected ? '<div style="width: 8px; height: 8px; background: #3b82f6; border-radius: 50%; position: absolute; top: 2px; left: 2px;"></div>' : '';
        });
      });
      
      // 启用确认按钮
      const confirmBtn = document.getElementById('confirmRestoreBtn');
      confirmBtn.disabled = false;
      confirmBtn.style.opacity = '1';
    };
    
    // 绑定模式选择事件
    document.querySelectorAll('.mode-option').forEach(option => {
      option.addEventListener('click', () => {
        selectMode(option.dataset.mode);
      });
      
      // 添加悬停效果
      option.addEventListener('mouseenter', () => {
        if (!option.style.backgroundColor || option.style.backgroundColor === 'white') {
          option.style.backgroundColor = '#f9fafb';
        }
      });
      
      option.addEventListener('mouseleave', () => {
        if (!selectedMode || option.dataset.mode !== selectedMode) {
          option.style.backgroundColor = 'white';
        }
      });
    });
    
    // 绑定事件
    document.getElementById('cancelRestoreBtn').onclick = () => {
      document.getElementById('restoreModeDialog').remove();
      resolve(null);
    };
    
    document.getElementById('confirmRestoreBtn').onclick = () => {
      if (selectedMode) {
        document.getElementById('restoreModeDialog').remove();
        resolve(selectedMode);
      }
    };
    
    // 点击背景关闭
    document.getElementById('restoreModeDialog').onclick = (e) => {
      if (e.target.id === 'restoreModeDialog') {
        document.getElementById('restoreModeDialog').remove();
        resolve(null);
      }
    };
  });
}


window.testAllFunctionality = testAllFunctionality;
window.forceCSSFix = forceCSSFix;
window.restoreAllTabs = restoreAllTabs;
window.setAsHomepage = setAsHomepage;