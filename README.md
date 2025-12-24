# 陀螺仪3D序列图片查看器

这是一个基于移动端陀螺仪的3D序列图片查看器，通过左右旋转手机可以查看不同视角的序列图片,PC端滑动左右鼠标。

[看示例页面https://coiichan.github.io/gyro3dweb](https://gyro3dweb.pages.dev/)


Quilt Format
(Quilt 格式)

Each tile in the quilt is a conventional 2D image of a scene. The bottom-left tile of the quilt (view 0) is the leftmost view of the scene, and the top-right tile is the rightmost, like so:
(Quilt拼图中的每块瓦片都是场景的常规二维图像。Quilt拼图左下角的瓦片（视图0）是场景最左侧的视角，而右上角的瓦片则是最右侧的视角，具体如下：)

[![https://coiichan.github.io/gyro3dweb/](https://docs.lookingglassfactory.com/~gitbook/image?url=https%3A%2F%2F1101008898-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-legacy-files%2Fo%2Fassets%252F-MWj8g-jOrSs315lrZFz%252Fsync%252F4033e85ad8499a86ba456f0983f5891ef2dcedf1.png%3Fgeneration%3D1616772675645811%26alt%3Dmedia&width=768&dpr=1&quality=100&sign=3397a241&sv=2)](https://gyro3dweb.pages.dev/)
## 使用方法

1. 将序列拼图为Quilt格式，放置在`quiltimages`文件夹中
2. 在移动端浏览器中打开`index.html`
3. 点击"开启陀螺仪"按钮并允许访问设备传感器
4. 左右旋转手机或者鼠标在画布左右滑动查看不同视角的图片
5. 可以重新设置新的行列和宽高比例并且下载嵌入该用户参数的新quiltimage


## 注意事项
- 多视点图片顺序为从左侧到右侧连续等视差图像
- 需要在支持陀螺仪的移动设备上使用
- 部分浏览器需要HTTPS环境或本地服务器环境才能访问传感器
- iOS设备需要用户明确授权传感器访问权限
