// 监听扩展安装或更新
chrome.runtime.onInstalled.addListener(function() {
    // 初始化存储
    chrome.storage.local.get(['notes'], function(result) {
        if (!result.notes) {
            chrome.storage.local.set({
                notes: ''
            });
        }
    });
});
