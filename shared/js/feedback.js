// ========== 反馈弹窗模块 ==========
// MD3 Dialog 风格，通过 PHP 后端发送邮件到站长 QQ 邮箱
// 邮件标题格式: [ACGN导航站反馈] {类型} - {时间}，方便 QQ 邮箱过滤器归类

(function() {
    'use strict';

    // DOM 引用
    const overlay = document.getElementById('feedbackOverlay');
    const closeBtn = document.getElementById('feedbackCloseBtn');
    const typeBtns = document.querySelectorAll('.feedback-type-btn');
    const contactInput = document.getElementById('feedbackContact');
    const contentInput = document.getElementById('feedbackContent');
    const submitBtn = document.getElementById('feedbackSubmitBtn');
    const cancelBtn = document.getElementById('feedbackCancelBtn');
    const statusDiv = document.getElementById('feedbackStatus');

    let selectedType = 'other';

    // 打开弹窗
    window.openFeedback = function() {
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    // 关闭弹窗
    function closeFeedback() {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
        // 重置状态
        setTimeout(() => {
            statusDiv.className = 'feedback-status';
            statusDiv.style.display = 'none';
            statusDiv.textContent = '';
            submitBtn.disabled = false;
            submitBtn.textContent = '发送反馈';
        }, 250);
    }

    // 类型选择
    typeBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            typeBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            selectedType = this.getAttribute('data-type');
        });
    });

    // 提交反馈
    submitBtn.addEventListener('click', function() {
        const content = contentInput.value.trim();
        if (!content) {
            showStatus('请填写反馈内容', 'error');
            return;
        }
        if (content.length > 2000) {
            showStatus('反馈内容不能超过 2000 字', 'error');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = '发送中...';

        const formData = new FormData();
        formData.append('type', selectedType);
        formData.append('contact', contactInput.value.trim());
        formData.append('content', content);

        fetch('php/send_feedback.php', {
            method: 'POST',
            body: formData
        })
        .then(function(res) {
            // 统一用 text() 读取，手动解析 JSON，避免 res.json() 在响应被污染时直接抛 SyntaxError
            return res.text().then(function(text) {
                // 非成功状态码：提取后端错误信息
                if (!res.ok) {
                    try {
                        var errData = JSON.parse(text);
                        var err = new Error(errData.msg || ('服务端错误 (' + res.status + ')'));
                        err._isServerMsg = true;
                        throw err;
                    } catch (e) {
                        if (e._isServerMsg) throw e;
                        if (e.message && !e.message.startsWith('服务端')) throw e;
                        var err2 = new Error('服务端错误 (' + res.status + ')');
                        err2._isServerMsg = true;
                        throw err2;
                    }
                }
                // 成功状态码：解析 JSON
                try {
                    var data = JSON.parse(text);
                } catch (e) {
                    throw new Error('服务器返回了无效数据');
                }
                if (!data) throw new Error('服务器返回了空响应');
                return data;
            });
        })
        .then(function(data) {
            if (data.ok) {
                showStatus(data.msg || '反馈已发送，感谢！', 'success');
                contentInput.value = '';
                contactInput.value = '';
                // 显示剩余次数
                if (data.remaining !== undefined) {
                    var remHint = statusDiv.textContent + '（30分钟内还可提交 ' + data.remaining + ' 次）';
                    statusDiv.textContent = remHint;
                }
                // 2秒后自动关闭
                setTimeout(closeFeedback, 3000);
            } else {
                showStatus(data.msg || '发送失败', 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = '发送反馈';
            }
        })
        .catch(function(err) {
            // 区分服务端错误（有具体提示）、响应解析错误、真实网络错误
            var msg;
            if (err._isServerMsg) {
                msg = err.message;
            } else if (err instanceof TypeError && err.message.includes('fetch')) {
                msg = '网络连接失败，请检查网络后重试';
            } else {
                msg = err.message || '网络错误，请稍后重试';
            }
            showStatus(msg, 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = '发送反馈';
        });
    });

    // 关闭按钮
    closeBtn.addEventListener('click', closeFeedback);
    cancelBtn.addEventListener('click', closeFeedback);

    // 点击遮罩关闭
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) closeFeedback();
    });

    // ESC 关闭
    var escHandler = function(e) {
        if (e.key === 'Escape' && overlay.classList.contains('active')) {
            closeFeedback();
        }
    };
    document.addEventListener('keydown', escHandler);

    // 页面卸载时移除全局事件监听，防止内存泄漏
    window.addEventListener('beforeunload', function() {
        document.removeEventListener('keydown', escHandler);
    });

    function showStatus(msg, type) {
        statusDiv.textContent = msg;
        statusDiv.className = 'feedback-status ' + type;
        statusDiv.style.display = 'block';
    }
})();
