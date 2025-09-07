# 🌐 Browser Window Assistant | 浏览器窗口助手

<div align="center">

![Extension Icon](icons/icon128.png)

**Intelligent browser tab and window management with automatic session saving and one-click restoration**  
**智能管理浏览器窗口和标签页，自动保存会话状态，支持一键恢复和分组管理**

[![Chrome Web Store](https://img.shields.io/badge/Chrome-Web%20Store-blue?style=for-the-badge&logo=googlechrome)](https://chrome.google.com/webstore)
[![Version](https://img.shields.io/badge/Version-1.2-green?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/License-MIT-orange?style=for-the-badge)](LICENSE)

[English](#english) | [中文](#中文)

</div>

---

## English

### 🌟 Key Features

- **🔄 Smart Session Management** - One-click save of all browser tabs and window states
- **📱 Tab Group Support** - Perfect integration with Chrome's native tab grouping feature
- **⚡ Flexible Restore Modes** - Fast restore and performance-friendly recovery options
- **🎨 Modern Interface** - Clean, unified blue theme design with intuitive controls
- **🌍 Multi-language Support** - Complete English/Chinese interface localization
- **🔒 Privacy & Security** - All data stored locally, zero data collection or uploads
- **📊 Smart Descriptions** - Auto-generated page summaries for better navigation
- **🎯 Window Management** - Save and close entire browser windows efficiently

### 🎯 Use Cases

- **Project Work** - Save project-related tabs and restore them when switching contexts
- **Research & Study** - Collect reference materials and restore them for later review
- **System Updates** - Safely backup all tabs before browser or system updates
- **Memory Optimization** - Close unused tabs to free memory while preserving access
- **Focus Sessions** - Store current work and switch to distraction-free browsing

### 🚀 Installation

#### Method 1: Chrome Web Store (Recommended)
1. Visit the [Chrome Web Store](https://chrome.google.com/webstore)
2. Search for "Browser Window Assistant"
3. Click "Add to Chrome"

#### Method 2: Developer Mode Installation
1. Download or clone this repository
2. Open Chrome extensions page: `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right)
4. Click "Load unpacked extension"
5. Select the project folder

### 📖 How to Use

1. **Save Session**: Click extension icon → "Save Snapshot Now"
2. **Restore Session**: Click extension icon → "Restore Snapshot" → Choose mode
3. **View Snapshots**: Click extension icon → "View Snapshot" → Browse saved tabs
4. **Group Restore**: In snapshot page, click restore button next to specific groups
5. **Quick Actions**: Use keyboard shortcuts for faster operations

### ⌨️ Keyboard Shortcuts

- `Ctrl+Shift+S`: Save current session snapshot
- `Ctrl+Shift+R`: Restore last saved snapshot  
- `Ctrl+Shift+V`: View current snapshot in browser
- `Ctrl+Shift+W`: Save snapshot and close all tabs

### 🛠 Technical Features

- **Manifest V3** - Built with latest Chrome extension standards
- **Service Worker Architecture** - Efficient background processing
- **Secure Storage** - Chrome's encrypted local storage APIs
- **CSP Compliant** - Content Security Policy adherent design
- **Performance Optimized** - Minimal memory footprint and fast operations
- **Error Resilient** - Comprehensive error handling and recovery

### 📸 Screenshots

*Screenshots showing the main interface, snapshot view, and restore modes will be displayed here*

### 🔧 Configuration

The extension works out-of-the-box with default settings optimized for most users. Advanced users can customize:

- Restore mode preferences (Fast vs Performance-friendly)
- Auto-save intervals and triggers
- Language interface selection
- Notification preferences

### 🐛 Troubleshooting

**Common Issues:**
- **Tabs not restoring**: Check if target URLs are accessible and permissions granted
- **Missing descriptions**: Some sites block script execution; descriptions will show as "Loading..."
- **Performance slow**: Use "Performance-friendly" restore mode for large sessions

**Getting Help:**
- Check the [Issues](../../issues) page for known problems
- Submit new issues with detailed descriptions
- Join discussions for feature requests

### 🤝 Contributing

We welcome contributions! Please:
1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a Pull Request

### 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### 🔒 Privacy Policy

- **No Data Collection**: We don't collect, store, or transmit personal information
- **Local Storage Only**: All session data remains on your device
- **No Analytics**: No usage tracking or analytics services
- **Open Source**: Full source code available for transparency

Read our complete [Privacy Policy](privacy-policy.html) for details.

---

## 中文

### 🌟 核心功能

- **🔄 智能会话管理** - 一键保存当前浏览器中的所有标签页和窗口状态
- **📱 标签页分组** - 完美支持Chrome原生标签页分组功能，可单独恢复特定分组
- **⚡ 灵活恢复模式** - 提供快速恢复和性能友好两种恢复选项
- **🎨 现代化界面** - 统一蓝色主题设计，直观易用的控制界面
- **🌍 多语言支持** - 完整的中文/英文界面本地化
- **🔒 隐私安全** - 所有数据仅存储在本地，零数据收集或上传
- **📊 智能描述** - 自动生成页面摘要，便于更好地导航
- **🎯 窗口管理** - 高效保存和关闭整个浏览器窗口

### 🎯 使用场景

- **项目工作** - 保存项目相关的多个标签页，切换工作环境时快速恢复
- **研究学习** - 收集参考资料并保存，便于后续查阅和复习
- **系统更新** - 浏览器或系统更新前安全备份所有标签页状态
- **内存优化** - 关闭暂不使用的标签页释放内存，同时保持访问能力
- **专注工作** - 保存当前工作状态，切换到无干扰的浏览模式

### 🚀 安装使用

#### 方式1: Chrome Web Store (推荐)
1. 访问 [Chrome Web Store](https://chrome.google.com/webstore)
2. 搜索 "Browser Window Assistant" 或 "浏览器窗口助手"
3. 点击"添加到Chrome"

#### 方式2: 开发者模式安装
1. 下载或克隆此仓库
2. 打开Chrome扩展页面：`chrome://extensions/`
3. 开启"开发者模式"（右上角开关）
4. 点击"加载已解压的扩展程序"
5. 选择项目文件夹

### 📖 使用方法

1. **保存会话**：点击扩展图标 → "立即保存快照"
2. **恢复会话**：点击扩展图标 → "恢复快照" → 选择恢复模式
3. **查看快照**：点击扩展图标 → "查看快照" → 浏览已保存的标签页
4. **分组恢复**：在快照页面点击特定分组旁的恢复按钮
5. **快速操作**：使用键盘快捷键进行更快操作

### ⌨️ 快捷键

- `Ctrl+Shift+S`：保存当前会话快照
- `Ctrl+Shift+R`：恢复最后保存的快照
- `Ctrl+Shift+V`：在浏览器中查看当前快照
- `Ctrl+Shift+W`：保存快照并关闭所有标签页

### 🛠 技术特性

- **Manifest V3** - 采用最新的Chrome扩展标准构建
- **Service Worker架构** - 高效的后台处理机制
- **安全存储** - 使用Chrome的加密本地存储API
- **CSP兼容** - 符合内容安全策略的设计
- **性能优化** - 最小内存占用和快速操作响应
- **错误恢复** - 全面的错误处理和恢复机制

### 📸 功能截图

*此处将显示主界面、快照视图和恢复模式的功能截图*

### 🔧 配置选项

扩展采用开箱即用的设计，默认设置已针对大多数用户进行优化。高级用户可以自定义：

- 恢复模式首选项（快速模式 vs 性能友好模式）
- 自动保存间隔和触发条件
- 界面语言选择
- 通知提醒偏好

### 🐛 故障排除

**常见问题：**
- **标签页无法恢复**：检查目标URL是否可访问，确认已授予相关权限
- **缺少页面描述**：某些网站阻止脚本执行，描述将显示为"加载中..."
- **性能较慢**：对于大型会话，请使用"性能友好"恢复模式

**获取帮助：**
- 查看 [Issues](../../issues) 页面了解已知问题
- 提交新问题时请包含详细描述
- 参与讨论提出功能需求

### 🤝 参与贡献

我们欢迎贡献！请遵循以下步骤：
1. Fork 此仓库
2. 创建功能分支：`git checkout -b feature-name`
3. 提交更改：`git commit -am 'Add feature'`
4. 推送到分支：`git push origin feature-name`
5. 提交Pull Request

### 📜 开源许可

本项目采用MIT许可证 - 详情请查看 [LICENSE](LICENSE) 文件。

### 🔒 隐私政策

- **无数据收集**：我们不收集、存储或传输个人信息
- **仅本地存储**：所有会话数据都保留在您的设备上
- **无分析追踪**：不使用任何使用跟踪或分析服务
- **开源透明**：完整源代码公开，确保透明度

阅读我们的完整[隐私政策](privacy-policy.html)了解详情。

---

### 📂 Project Structure | 项目结构

```
browser-window-assistant/
├── manifest.json              # Extension manifest | 扩展清单
├── background.js              # Service worker | 后台服务
├── popup.html/js              # Extension popup | 扩展弹窗
├── snapshot.html              # Snapshot viewer | 快照查看器
├── snapshot-script.js         # Snapshot logic | 快照逻辑
├── icons/                     # Extension icons | 扩展图标
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── _locales/                  # Internationalization | 国际化
│   ├── en/messages.json       # English messages | 英文消息
│   └── zh_CN/messages.json    # Chinese messages | 中文消息
├── privacy-policy.html        # Privacy policy | 隐私政策
├── PRIVACY_POLICY.md         # Privacy documentation | 隐私文档
├── PERMISSION_JUSTIFICATIONS.md # Permission explanations | 权限说明
└── README.md                 # This file | 本文件
```

### 🔄 Changelog | 更新日志

#### Version 1.2 | 版本 1.2
- ✅ Enhanced security with XSS prevention | 增强XSS防护安全性
- ✅ Improved loading indicators and user feedback | 改进加载指示器和用户反馈
- ✅ Optimized performance and error handling | 优化性能和错误处理
- ✅ Added comprehensive testing framework | 添加综合测试框架
- ✅ Complete bilingual interface support | 完整的双语界面支持

#### Version 1.1 | 版本 1.1
- ✅ Tab group management functionality | 标签页分组管理功能
- ✅ Save and close window feature | 保存并关闭窗口功能
- ✅ Improved restoration modes | 改进的恢复模式

#### Version 1.0 | 版本 1.0
- ✅ Initial release with core functionality | 核心功能的初始版本
- ✅ Basic session save and restore | 基础会话保存和恢复
- ✅ Chrome extension popup interface | Chrome扩展弹窗界面

### 🚀 Roadmap | 开发计划

#### Upcoming Features | 即将推出的功能
- 🔄 Advanced window management | 高级窗口管理
- 📱 Mobile browser support | 移动浏览器支持  
- ☁️ Optional cloud synchronization | 可选云端同步
- 🤖 AI-powered smart grouping | AI智能分组
- 📊 Usage analytics and insights | 使用统计和洞察
- 🎨 Customizable themes | 可自定义主题

---

<div align="center">

### 🌟 Support This Project | 支持这个项目

**⭐ If this project helps you, please give it a Star!**  
**⭐ 如果这个项目对你有帮助，请给个Star！**

**🐛 Found a bug? Report it [here](../../issues)**  
**🐛 发现问题？请在[这里](../../issues)报告**

**💡 Have a feature request? Let us know [here](../../discussions)**  
**💡 有功能建议？请在[这里](../../discussions)告诉我们**

---

**Made with ❤️ by developers, for developers**  
**由开发者用❤️为开发者制作**

</div>
