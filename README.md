# 陀螺仪3D序列图片查看器

这是一个基于移动端陀螺仪的3D序列图片查看器，通过左右旋转手机可以查看不同视角的序列图片。

[点击下图查看示例页面https://coiichan.github.io/gyro3dweb](https://gyro3dweb.pages.dev/)

[![https://coiichan.github.io/gyro3dweb/](https://github.com/CoiiChan/gyro3dweb/blob/master/images/view_9.png)](https://gyro3dweb.pages.dev/)
## 使用方法

1. 将3D序列图片命名为`view_0.jpg`, `view_1.jpg`, ..., `view_n.jpg`格式
2. 将所有图片放置在`images`文件夹中
3. 在移动端浏览器中打开`index.html`
4. 点击"开始体验"按钮并允许访问设备传感器
5. 左右旋转手机查看不同视角的图片

## 配置参数

可以在`app.js`文件中调整以下配置参数：
- `sensitivity`: 灵敏度系数（默认1.5）
- `minAngle`: 最小旋转角度（默认-30）
- `maxAngle`: 最大旋转角度（默认30）
- `totalImages`: 序列图片总数（默认17）
- `imageBasePath`: 图片基础路径（默认'images/view_'）
- `imageExtension`: 图片扩展名（默认'.png'）

## 注意事项
- 多视点图片顺序为从左侧到右侧连续等视差图像
- 需要在支持陀螺仪的移动设备上使用
- 部分浏览器需要HTTPS环境或本地服务器环境才能访问传感器
- iOS设备需要用户明确授权传感器访问权限
