document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-btn');
    const imageContainer = document.getElementById('image-container');
    const loadingIndicator = document.querySelector('.loading');
    let images = [];
    let currentImageIndex = 0;
    let isActive = false;
    let isDragging = false;
    let startX = 0;
    let startIndex = 0;
    let totalImages = 17; // 默认17张序列图片
    let imageBasePath = 'images/view_'; // 图片基础路径
    let imageExtension = '.png'; // 图片扩展名

    // 配置参数 - 可根据实际情况调整
    const config = {
        sensitivity: 1.5, // 陀螺仪灵敏度系数
        touchSensitivity: 500, // 触摸灵敏度(像素)
        minAngle: -30, // 最小旋转角度
        maxAngle: 30, // 最大旋转角度
        startDelay: 500 // 启动延迟(ms)
    };

    // 初始化图片序列
    function initImages() {
        loadingIndicator.textContent = '正在加载图片...';
        images = [];
        imageContainer.innerHTML = '';

        // 创建图片元素
        for (let i = 0; i < totalImages; i++) {
            const img = document.createElement('img');
            img.src = `${imageBasePath}${i}${imageExtension}`;
            img.alt = `View ${i}`;
            img.dataset.index = i;
            imageContainer.appendChild(img);
            images.push(img);

            // 第一张图片设为活动状态
            if (i === 0) {
                img.classList.add('active');
            }
        }

        // 检查图片加载状态
        checkImagesLoaded();
    }

    // 检查所有图片是否加载完成
    function checkImagesLoaded() {
        const loadedImages = images.filter(img => img.complete);
        if (loadedImages.length === totalImages) {
            loadingIndicator.textContent = '图片加载完成';
            setTimeout(() => {
                loadingIndicator.style.display = 'none';
            }, config.startDelay);
        } else {
            loadingIndicator.textContent = `加载中... ${loadedImages.length}/${totalImages}`;
            setTimeout(checkImagesLoaded, 100);
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

    // 初始化图片
    initImages();

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
});