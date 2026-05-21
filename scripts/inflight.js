// content.js 监听 url 变化；直接 landing 到 inflight 页面时不会触发该 listener，
// 因此这里轮询等待版本页面头部渲染完成（Save 按钮出现）后再挂接拦截器。
checkLoaded();
function checkLoaded() {
  setTimeout(() => {
    if (msGetSaveButton()) {
      replaceButton();
    } else {
      checkLoaded();
    }
  }, 3500);
}
