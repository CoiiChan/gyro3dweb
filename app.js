document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-btn');
    const uploadBtn = document.getElementById('upload-btn');
    const fileInput = document.getElementById('file-input');
    const imageContainer = document.getElementById('image-container');
    const loadingIndicator = document.querySelector('.loading');
    const columnsInput = document.getElementById('columns');
    const rowsInput = document.getElementById('rows');
    const aspectInput = document.getElementById('aspect');
    
    let images = [];
    let currentImageIndex = 0;
    let isActive = false;
    let isDragging = false;
    let startX = 0;
    let startIndex = 0;
    let totalImages = 45; // 默认5列9行 = 45张图片
    let quiltImagePath = 'quiltimages/quilt.jpg'; // 默认Quilt图像路径
    let useLocalQuilt = false; // 是否使用本地quilt图片

    // 配置参数 - 可根据实际情况调整
    const config = {
        sensitivity: 1.5, // 陀螺仪灵敏度系数
        touchSensitivity: 500, // 触摸灵敏度(像素)
        minAngle: -30, // 最小旋转角度
        maxAngle: 30, // 最大旋转角度
        startDelay: 500 // 启动延迟(ms)
    };

    // 从quilt图像中提取子图
    function extractImagesFromQuilt(quiltImage, columns, rows, aspectRatio) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // 计算每个子图的尺寸
            const quiltWidth = quiltImage.width;
            const quiltHeight = quiltImage.height;
            const cellWidth = quiltWidth / columns;
            const cellHeight = quiltHeight / rows;
            
            // 宽高比是宽度/高度，所以调整后的高度 = 宽度 / 宽高比
            const adjustedCellHeight = cellWidth / aspectRatio;
            
            const extractedImages = [];
            let loadedCount = 0;
            
            // 按照指定顺序提取图像：从最底下一行左下角开始，到最右上角结束
            for (let row = rows - 1; row >= 0; row--) {
                for (let col = 0; col < columns; col++) {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // 设置画布尺寸，考虑宽高比
                    canvas.width = cellWidth;
                    canvas.height = adjustedCellHeight;
                    
                    // 计算源图像中的位置
                    const sourceX = col * cellWidth;
                    const sourceY = row * cellHeight;
                    
                    // 绘制子图
                    ctx.drawImage(
                        quiltImage,
                        sourceX, sourceY, cellWidth, cellHeight,
                        0, 0, cellWidth, adjustedCellHeight
                    );
                    
                    // 转换为图像对象
                    const img = new Image();
                    img.onload = () => {
                        loadedCount++;
                        if (loadedCount === columns * rows) {
                            resolve(extractedImages);
                        }
                    };
                    img.onerror = () => {
                        reject(new Error('Failed to load extracted image'));
                    };
                    img.src = canvas.toDataURL();
                    img.dataset.index = extractedImages.length;
                    extractedImages.push(img);
                }
            }
        });
    }

    // 初始化图片序列
    async function initImages() {
        loadingIndicator.textContent = '正在加载图片...';
        images = [];
        imageContainer.innerHTML = '';

        try {
            // 使用quilt图像
            const columns = parseInt(columnsInput.value);
            const rows = parseInt(rowsInput.value);
            const aspectRatio = parseFloat(aspectInput.value);
            
            totalImages = columns * rows;
            
            const quiltImg = new Image();
            quiltImg.crossOrigin = 'anonymous';
            
            await new Promise((resolve, reject) => {
                quiltImg.onload = resolve;
                quiltImg.onerror = reject;
                
                if (useLocalQuilt && fileInput.files[0]) {
                    // 使用本地文件
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        quiltImg.src = e.target.result;
                    };
                    reader.readAsDataURL(fileInput.files[0]);
                } else {
                    // 使用默认文件
                    quiltImg.src = quiltImagePath;
                }
            });
            
            loadingIndicator.textContent = '正在拆分quilt图像...';
            images = await extractImagesFromQuilt(quiltImg, columns, rows, aspectRatio);
            
            // 添加到DOM并设置第一张为活动状态
            images.forEach((img, index) => {
                imageContainer.appendChild(img);
                if (index === 0) {
                    img.classList.add('active');
                }
            });
            
            loadingIndicator.textContent = '图片加载完成';
            setTimeout(() => {
                loadingIndicator.style.display = 'none';
            }, config.startDelay);
            
        } catch (error) {
            console.error('Image loading error:', error);
            loadingIndicator.textContent = '图片加载失败: ' + error.message;
        }
    }

    // 根据角度更新显示的图片
    function updateImageByAngle(angle) {
        // 将角度映射到图片索引
        const normalizedAngle = Math.max(config.minAngle, Math.min(config.maxAngle, angle));
        const index = Math.round(
            ((normalizedAngle - config.minAngle) / (config.maxAngle - config.minAngle)) * (totalImages - 1)
        );

        // 确保索引在有效范围内
        const clampedIndex = Math.max(0, Math.min(totalImages - 1, index));
        setCurrentImageIndex(clampedIndex);
    }

    function setCurrentImageIndex(index) {
        if (index === currentImageIndex) return;
        images[currentImageIndex].classList.remove('active');
        images[index].classList.add('active');
        currentImageIndex = index;
    }

    // 处理设备方向事件
    function handleDeviceOrientation(event) {
        if (!isActive) return;

        // 根据屏幕方向选择合适的陀螺仪轴
        let angle;
        const isLandscape = window.innerWidth > window.innerHeight;
        if (isLandscape) {
            // 横屏模式使用beta值(上下旋转)
            angle = -event.beta * config.sensitivity;
        } else {
            // 竖屏模式使用gamma值(左右旋转)
            angle = -event.gamma * config.sensitivity;
        }
        updateImageByAngle(angle);
        
        // 更新startIndex以保持控制连贯性
        startIndex = currentImageIndex;
    }

    // 启动陀螺仪监听
    function startGyroscope() {
        if (typeof DeviceOrientationEvent !== 'undefined' && 'requestPermission' in DeviceOrientationEvent) {
            // iOS 13+ 需要用户授权
            DeviceOrientationEvent.requestPermission()
                .then(permissionState => {
                    if (permissionState === 'granted') {
                        window.addEventListener('deviceorientation', handleDeviceOrientation);
                        isActive = true;
                        startBtn.textContent = '停止体验';
                        loadingIndicator.style.display = 'none';
                    }
                })
                .catch(console.error);
        } else if (typeof DeviceOrientationEvent !== 'undefined') {
            // 非iOS设备直接监听事件
            window.addEventListener('deviceorientation', handleDeviceOrientation);
            isActive = true;
            startBtn.textContent = '停止体验';
            loadingIndicator.style.display = 'none';
        } else {
            alert('您的设备不支持陀螺仪功能');
        }
    }

    // 停止陀螺仪监听
    function stopGyroscope() {
        window.removeEventListener('deviceorientation', handleDeviceOrientation);
        isActive = false;
        startBtn.textContent = '开始体验';
    }

    // 开始/停止按钮点击事件
    startBtn.addEventListener('click', () => {
        if (isActive) {
            stopGyroscope();
        } else {
            startGyroscope();
        }
    });

    // 本地quilt图片按钮点击事件
    uploadBtn.addEventListener('click', () => {
        fileInput.click();
    });

    // 文件选择事件
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            useLocalQuilt = true;
            uploadBtn.textContent = file.name.substring(0, 10) + '...';
            uploadBtn.style.backgroundColor = '#4CAF50';
            initImages();
        } else {
            alert('请选择有效的图片文件');
        }
    });

    // 控制参数变化时重新初始化
    [columnsInput, rowsInput, aspectInput].forEach(input => {
        input.addEventListener('change', () => {
            initImages();
        });
    });

    // 添加触摸滑动支持
    function handleDragStart(e) {
        isDragging = true;
        startX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        startIndex = currentImageIndex;
        e.preventDefault();
    }

    function handleDragEnd() {
        isDragging = false;
    }

    imageContainer.addEventListener('touchstart', handleDragStart);
    imageContainer.addEventListener('mousedown', handleDragStart);

    imageContainer.addEventListener('touchmove', handleDragMove);
    imageContainer.addEventListener('mousemove', handleDragMove);
    imageContainer.addEventListener('mouseenter', () => {
        isDragging = true;
    });
    imageContainer.addEventListener('mouseleave', () => {
        isDragging = false;
    });

    function handleDragMove(e) {
        if (e.type === 'mousemove' && !isDragging) {
            const containerRect = imageContainer.getBoundingClientRect();
            const mouseX = e.clientX - containerRect.left;
            const normalizedPosition = mouseX / containerRect.width;
            const newIndex = totalImages - 1 - Math.round(normalizedPosition * (totalImages - 1));
            setCurrentImageIndex(newIndex);
            return;
        }
        
        if (!isDragging) return;
        const currentX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        const totalDelta = startX - currentX;
        const threshold = config.touchSensitivity;
        const steps = Math.floor(Math.abs(totalDelta) / threshold);

        if (steps > 0) {
            const direction = totalDelta > 0 ? 1 : -1;
            const newIndex = startIndex + direction * steps;
            setCurrentImageIndex(Math.max(0, Math.min(totalImages - 1, newIndex)));
        }
        e.preventDefault();
    }

    imageContainer.addEventListener('touchend', handleDragEnd);
    imageContainer.addEventListener('mouseup', handleDragEnd);
    imageContainer.addEventListener('mouseleave', handleDragEnd);

    // 初始化图片
    initImages();
});