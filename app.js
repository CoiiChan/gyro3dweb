document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-btn');
    const uploadBtn = document.getElementById('upload-btn');
    const fileInput = document.getElementById('file-input');
    const imageContainer = document.getElementById('image-container');
    const loadingIndicator = document.querySelector('.loading');
    const columnsInput = document.getElementById('columns');
    const rowsInput = document.getElementById('rows');
    const aspectInput = document.getElementById('aspect');
    const exifTextArea = document.getElementById('exif-text');
    
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

    // 解析EXIF信息并获取基础图片信息（支持JPEG和PNG）
    function parseEXIF(file) {
        return new Promise((resolve) => {
            // 创建一个包含基础信息的对象
            const imageInfo = {
                fileSize: file.size,
                fileName: file.name,
                fileType: file.type
            };
            
            // 获取图片分辨率（无论什么格式都可以通过Image对象获取）
            const img = new Image();
            img.onload = function() {
                imageInfo.imageSize = {
                    width: this.width,
                    height: this.height
                };
                
                // 然后解析文件特定的元数据
                const reader = new FileReader();
                reader.onload = function(e) {
                    const arrayBuffer = e.target.result;
                    const dataView = new DataView(arrayBuffer);
                    
                    // 检测文件类型
                    if (dataView.getUint8(0) === 0xFF && dataView.getUint8(1) === 0xD8) {
                        // JPEG文件
                        parseJPEGEXIF(dataView, imageInfo);
                    } else if (dataView.getUint8(0) === 0x89 && dataView.getUint8(1) === 0x50 && 
                               dataView.getUint8(2) === 0x4E && dataView.getUint8(3) === 0x47) {
                        // PNG文件
                        parsePNGInfo(dataView, imageInfo);
                    } else {
                        // 未知格式
                        imageInfo.fileType = '未知格式';
                    }
                    
                    // 提取Columns、Rows和Aspect信息
                    extractColumnsRowsAspect(imageInfo);
                    resolve(imageInfo);
                };
                
                reader.onerror = function() {
                    resolve(imageInfo); // 即使解析失败，也要返回基础信息
                };
                
                reader.readAsArrayBuffer(file);
            };
            
            img.onerror = function() {
                // 如果图片加载失败，仍然返回基础文件信息
                resolve(imageInfo);
            };
            
            img.src = URL.createObjectURL(file);
        });
    }
    
    // 从EXIF信息中提取Columns、Rows和Aspect值
    function extractColumnsRowsAspect(imageInfo) {
        // 尝试从PNG的tEXt元数据中提取
        if (imageInfo.pngInfo) {
            for (const key in imageInfo.pngInfo) {
                if (key.startsWith('tEXt_') || key.startsWith('iTXt_')) {
                    const metadataKey = key.substring(5);
                    const value = imageInfo.pngInfo[key];
                    
                    if (metadataKey.toLowerCase() === 'columns' || metadataKey.toLowerCase() === 'gyro3d_columns') {
                        imageInfo.columns = parseInt(value);
                    } else if (metadataKey.toLowerCase() === 'rows' || metadataKey.toLowerCase() === 'gyro3d_rows') {
                        imageInfo.rows = parseInt(value);
                    } else if (metadataKey.toLowerCase() === 'aspect' || metadataKey.toLowerCase() === 'gyro3d_aspect') {
                        imageInfo.aspect = parseFloat(value);
                    }
                }
            }
        }
        
        // 尝试从JPEG的EXIF原始文本中提取
        if (imageInfo.exifRaw) {
            const exifLines = imageInfo.exifRaw.split('\n');
            for (const line of exifLines) {
                if (line.toLowerCase().includes('columns')) {
                    const match = line.match(/columns\s*:\s*(\d+)/i);
                    if (match) imageInfo.columns = parseInt(match[1]);
                } else if (line.toLowerCase().includes('rows')) {
                    const match = line.match(/rows\s*:\s*(\d+)/i);
                    if (match) imageInfo.rows = parseInt(match[1]);
                } else if (line.toLowerCase().includes('aspect')) {
                    const match = line.match(/aspect\s*:\s*(\d+(\.\d+)?)/i);
                    if (match) imageInfo.aspect = parseFloat(match[1]);
                }
            }
        }
    }
    
    // 从图片URL获取EXIF信息
    function getEXIFFromURL(url) {
        return new Promise((resolve) => {
            fetch(url)
                .then(response => {
                    // 获取文件大小
                    const fileSize = response.headers.get('content-length');
                    return response.blob().then(blob => ({ blob, fileSize }));
                })
                .then(({ blob, fileSize }) => {
                    const imageInfo = {
                        fileSize: fileSize ? parseInt(fileSize) : undefined,
                        fileName: url.split('/').pop()
                    };
                    
                    // 获取图片分辨率
                    return new Promise((resolveImg) => {
                        const img = new Image();
                        img.onload = function() {
                            imageInfo.imageSize = {
                                width: this.width,
                                height: this.height
                            };
                            
                            // 解析Blob数据以获取EXIF信息
                            const reader = new FileReader();
                            reader.onload = function(e) {
                                const arrayBuffer = e.target.result;
                                const dataView = new DataView(arrayBuffer);
                                
                                // 检测文件类型
                                if (dataView.getUint8(0) === 0xFF && dataView.getUint8(1) === 0xD8) {
                                    // JPEG文件
                                    parseJPEGEXIF(dataView, imageInfo);
                                } else if (dataView.getUint8(0) === 0x89 && dataView.getUint8(1) === 0x50 && 
                                           dataView.getUint8(2) === 0x4E && dataView.getUint8(3) === 0x47) {
                                    // PNG文件
                                    parsePNGInfo(dataView, imageInfo);
                                } else {
                                    // 未知格式
                                    imageInfo.fileType = '未知格式';
                                }
                                
                                // 提取Columns、Rows和Aspect信息
                                extractColumnsRowsAspect(imageInfo);
                                resolveImg(imageInfo);
                            };
                            
                            reader.onerror = function() {
                                resolveImg(imageInfo);
                            };
                            
                            reader.readAsArrayBuffer(blob);
                        };
                        img.onerror = function() {
                            resolveImg(imageInfo);
                        };
                        img.src = URL.createObjectURL(blob);
                    });
                })
                .then(imageInfo => resolve(imageInfo))
                .catch(() => resolve({}));
        });
    }
    
    // 解析JPEG文件的EXIF信息
    function parseJPEGEXIF(dataView, imageInfo) {
        let offset = 2;
        const length = dataView.byteLength;
        let exifText = "";
        
        // 寻找EXIF标记
        while (offset < length) {
            if (dataView.getUint8(offset) !== 0xFF) {
                break;
            }
            
            const marker = dataView.getUint8(offset + 1);
            const markerSize = dataView.getUint16(offset + 2) + 2;
            
            // 寻找APP1标记(EXIF)
            if (marker === 0xE1) {
                // 检查EXIF头
                if (dataView.getUint32(offset + 4) === 0x45786966) {
                    // 简化处理：将EXIF部分转换为文本显示
                    for (let i = offset + 4; i < Math.min(offset + markerSize, length); i++) {
                        const char = String.fromCharCode(dataView.getUint8(i));
                        if ((char >= ' ' && char <= '~') || char === '\n' || char === '\r' || char === '\t') {
                            exifText += char;
                        } else {
                            exifText += '.';
                        }
                    }
                    break;
                }
            }
            
            offset += markerSize;
        }
        
        if (exifText) {
            imageInfo.exifRaw = exifText;
        }
    }
    
    // 解析PNG文件的基本信息和元数据
    function parsePNGInfo(dataView, imageInfo) {
        // PNG文件的基本信息
        imageInfo.pngInfo = {
            width: dataView.getUint32(16, false), // 大端字节序
            height: dataView.getUint32(20, false),
            bitDepth: dataView.getUint8(24),
            colorType: dataView.getUint8(25),
            compressionMethod: dataView.getUint8(26),
            filterMethod: dataView.getUint8(27),
            interlaceMethod: dataView.getUint8(28)
        };
        
        // 将颜色类型转换为可读文本
        const colorTypeMap = {
            0: 'Grayscale',
            2: 'RGB',
            3: 'Indexed',
            4: 'Grayscale with Alpha',
            6: 'RGB with Alpha'
        };
        imageInfo.pngInfo.colorTypeText = colorTypeMap[imageInfo.pngInfo.colorType] || 'Unknown';
        
        // 将压缩方法转换为可读文本
        const compressionMap = {
            0: 'Deflate/Inflate'
        };
        imageInfo.pngInfo.compressionText = compressionMap[imageInfo.pngInfo.compressionMethod] || 'Unknown';
        
        // 将隔行扫描方法转换为可读文本
        const interlaceMap = {
            0: 'Noninterlaced',
            1: 'Adam7'
        };
        imageInfo.pngInfo.interlaceText = interlaceMap[imageInfo.pngInfo.interlaceMethod] || 'Unknown';
        
        // 寻找PNG的元数据块（如tEXt、iTXt、zTXt）
        let offset = 8; // PNG签名长度为8字节
        const length = dataView.byteLength;
        
        while (offset < length) {
            // 块长度（4字节，大端）
            const chunkLength = dataView.getUint32(offset, false);
            offset += 4;
            
            // 块类型（4字节）
            const chunkType = String.fromCharCode(
                dataView.getUint8(offset),
                dataView.getUint8(offset + 1),
                dataView.getUint8(offset + 2),
                dataView.getUint8(offset + 3)
            );
            offset += 4;
            
            // 块数据
            const chunkData = new Uint8Array(dataView.buffer, offset, chunkLength);
            
            // 尝试解析文本元数据块
            if (chunkType === 'tEXt' || chunkType === 'iTXt' || chunkType === 'zTXt') {
                try {
                    // 提取关键字和文本内容
                    let keyword = '';
                    let text = '';
                    let i = 0;
                    
                    // 读取关键字（以null结尾）
                    while (i < chunkLength && chunkData[i] !== 0) {
                        keyword += String.fromCharCode(chunkData[i]);
                        i++;
                    }
                    i++; // 跳过null分隔符
                    
                    // 读取文本内容
                    if (i < chunkLength) {
                        text = new TextDecoder('utf-8').decode(chunkData.slice(i));
                        
                        // 如果是zTXt块，需要解压缩（这里简化处理，只显示原始内容）
                        if (chunkType === 'zTXt') {
                            text = '[压缩的文本数据]';
                        }
                    }
                    
                    if (keyword) {
                        imageInfo.pngInfo[chunkType + '_' + keyword] = text;
                    }
                } catch (e) {
                    // 解析失败，继续处理下一个块
                }
            }
            
            // 跳过块数据和CRC
            offset += chunkLength + 4;
        }
    }
    
    // 显示EXIF信息（支持JPEG和PNG）
    function displayEXIF(imageInfo) {
        if (!exifTextArea) return;
        
        let exifContent = "";
        
        // 添加基础信息
        exifContent += `Image Size                       : ${imageInfo.imageSize ? `${imageInfo.imageSize.width} × ${imageInfo.imageSize.height}` : '无法获取'}\n`;
        
        // 格式化文件大小
        let fileSizeStr = '无法获取';
        if (imageInfo.fileSize !== undefined) {
            const fileSize = imageInfo.fileSize;
            if (fileSize < 1024) {
                fileSizeStr = `${fileSize} B`;
            } else if (fileSize < 1024 * 1024) {
                fileSizeStr = `${(fileSize / 1024).toFixed(1)} KB`;
            } else if (fileSize < 1024 * 1024 * 1024) {
                fileSizeStr = `${(fileSize / (1024 * 1024)).toFixed(1)} MB`;
            } else {
                fileSizeStr = `${(fileSize / (1024 * 1024 * 1024)).toFixed(1)} GB`;
            }
        }
        exifContent += `File Size                        : ${fileSizeStr}\n`;
        
        // 添加文件名
        exifContent += `File Name                        : ${imageInfo.fileName || '无法获取'}\n`;
        
        // 添加文件类型
        exifContent += `File Type                        : ${imageInfo.fileType || '无法获取'}\n`;
        
        // 如果是PNG文件，添加PNG特定信息
        if (imageInfo.pngInfo) {
            exifContent += `\nPNG Specific Information:\n`;
            exifContent += `Bit Depth                        : ${imageInfo.pngInfo.bitDepth}\n`;
            exifContent += `Color Type                       : ${imageInfo.pngInfo.colorTypeText}\n`;
            exifContent += `Compression                      : ${imageInfo.pngInfo.compressionText}\n`;
            exifContent += `Filter                           : Adaptive\n`;
            exifContent += `Interlace                        : ${imageInfo.pngInfo.interlaceText}\n`;
            
            // 添加PNG元数据（如果有）
            for (const key in imageInfo.pngInfo) {
                if (key.startsWith('tEXt_') || key.startsWith('iTXt_') || key.startsWith('zTXt_')) {
                    const metadataKey = key.substring(5);
                    exifContent += `${metadataKey.padEnd(34)} : ${imageInfo.pngInfo[key]}\n`;
                }
            }
        } else if (imageInfo.exifRaw) {
            // 添加原始EXIF信息（JPEG文件）
            exifContent += `\n原始EXIF信息:\n${imageInfo.exifRaw}`;
        } else {
            exifContent += `\n元数据信息:\n未检出具体元数据`;
        }
        
        exifTextArea.value = exifContent;
    }
    
    // 初始化图片序列
    async function initImages(skipEXIF = false) {
        loadingIndicator.textContent = '正在加载图片...';
        images = [];
        imageContainer.innerHTML = '';

        try {
            // 先获取EXIF信息，设置Columns、Rows和Aspect
            let imageInfo;
            if (useLocalQuilt && fileInput.files[0]) {
                // 使用本地文件
                imageInfo = await parseEXIF(fileInput.files[0]);
            } else {
                // 使用默认文件
                imageInfo = await getEXIFFromURL(quiltImagePath);
            }
            
            // 从EXIF信息中设置Columns、Rows和Aspect，如果没有则使用当前值
            // 当skipEXIF为true时，不覆盖用户手动设置的值
            if (!skipEXIF) {
                if (imageInfo.columns) {
                    columnsInput.value = imageInfo.columns;
                }
                if (imageInfo.rows) {
                    rowsInput.value = imageInfo.rows;
                }
                if (imageInfo.aspect) {
                    aspectInput.value = imageInfo.aspect;
                }
            }
            
            // 使用设置后的值
            const columns = parseInt(columnsInput.value);
            const rows = parseInt(rowsInput.value);
            const aspectRatio = parseFloat(aspectInput.value);
            
            totalImages = columns * rows;
            
            // 加载quilt图像
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
                        startBtn.textContent = '停止陀螺仪';
                        loadingIndicator.style.display = 'none';
                    }
                })
                .catch(console.error);
        } else if (typeof DeviceOrientationEvent !== 'undefined') {
            // 非iOS设备直接监听事件
            window.addEventListener('deviceorientation', handleDeviceOrientation);
            isActive = true;
            startBtn.textContent = '停止陀螺仪';
            loadingIndicator.style.display = 'none';
        } else {
            alert('您的设备不支持陀螺仪功能');
        }
    }

    // 停止陀螺仪监听
    function stopGyroscope() {
        window.removeEventListener('deviceorientation', handleDeviceOrientation);
        isActive = false;
        startBtn.textContent = '开启陀螺仪';
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

    // 控制参数变化时重新初始化
    [columnsInput, rowsInput, aspectInput].forEach(input => {
        input.addEventListener('change', () => {
            initImages(true); // true表示跳过从EXIF获取值，使用用户设置的值
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

    // 更新文件选择事件以显示EXIF信息
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            useLocalQuilt = true;
            uploadBtn.textContent = file.name.substring(0, 10) + '...';
            uploadBtn.style.backgroundColor = '#4CAF50';
            
            // 解析并显示EXIF信息
            parseEXIF(file).then(displayEXIF);
            
            initImages();
        } else {
            alert('请选择有效的图片文件');
        }
    });
    
    // 初始化时尝试获取默认图片的EXIF信息
    getEXIFFromURL(quiltImagePath).then(displayEXIF);
    
    // 初始化图片
    initImages();

    // 添加强制覆盖按钮的事件监听
    const forceOverwriteBtn = document.getElementById('force-overwrite-btn');
    if (forceOverwriteBtn) {
        forceOverwriteBtn.addEventListener('click', handleForceOverwrite);
    }

    // 处理强制覆盖EXIF信息的点击事件
    async function handleForceOverwrite() {
        const columns = parseInt(columnsInput.value);
        const rows = parseInt(rowsInput.value);
        const aspect = parseFloat(aspectInput.value);

        loadingIndicator.style.display = 'block';
        loadingIndicator.textContent = '正在处理图片...';

        try {
            let file, fileBlob;
            if (fileInput.files[0]) {
                // 使用用户上传的图片
                file = fileInput.files[0];
                fileBlob = file;
            } else {
                // 使用默认的quilt图片
                const response = await fetch(quiltImagePath);
                if (!response.ok) {
                    throw new Error('无法加载默认图片');
                }
                fileBlob = await response.blob();
                file = new File([fileBlob], 'quilt.jpg', { type: fileBlob.type });
            }

            if (file.type === 'image/png' || file.type === 'image/jpeg') {
                // 处理图片：转换为PNG后再添加元数据（统一处理为PNG格式）
                let pngBlob;
                if (file.type === 'image/jpeg') {
                    pngBlob = await convertJPGToPNG(file);
                } else {
                    pngBlob = fileBlob;
                }
                const modifiedBlob = await writePNGMetadata(pngBlob, columns, rows, aspect);
                downloadImage(modifiedBlob, 'quiltimage_with_exif.png');
            } else {
                alert('不支持的图片格式，请使用PNG或JPEG格式的图片');
            }

            loadingIndicator.textContent = '处理完成，图片已下载';
            setTimeout(() => {
                loadingIndicator.style.display = 'none';
            }, 1500);
        } catch (error) {
            console.error('处理图片失败:', error);
            loadingIndicator.textContent = '处理失败: ' + error.message;
        }
    }

    // 将JPEG图片转换为PNG格式
    async function convertJPGToPNG(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    // 创建Canvas元素并设置相同的尺寸
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    
                    // 在Canvas上绘制图片
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    
                    // 将Canvas内容转换为PNG Blob
                    canvas.toBlob((blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('转换为PNG失败'));
                        }
                    }, 'image/png');
                };
                img.onerror = (e) => reject(new Error('图片加载失败'));
                img.src = e.target.result;
            };
            reader.onerror = (e) => reject(new Error('文件读取失败'));
            reader.readAsDataURL(file);
        });
    }

    // 写入PNG图片的元数据
    async function writePNGMetadata(file, columns, rows, aspect) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const arrayBuffer = e.target.result;
                    const dataView = new DataView(arrayBuffer);
                    
                    // 验证PNG文件
                    if (dataView.getUint8(0) !== 0x89 || dataView.getUint8(1) !== 0x50 || 
                        dataView.getUint8(2) !== 0x4E || dataView.getUint8(3) !== 0x47) {
                        throw new Error('不是有效的PNG文件');
                    }

                    // 提取所有PNG块
                    const chunks = [];
                    let offset = 8; // PNG签名长度为8字节
                    const length = dataView.byteLength;

                    while (offset < length) {
                        // 块长度（4字节，大端）
                        const chunkLength = dataView.getUint32(offset, false);
                        offset += 4;
                        
                        // 块类型（4字节）
                        const chunkType = String.fromCharCode(
                            dataView.getUint8(offset),
                            dataView.getUint8(offset + 1),
                            dataView.getUint8(offset + 2),
                            dataView.getUint8(offset + 3)
                        );
                        offset += 4;
                        
                        // 块数据
                        const chunkData = new Uint8Array(dataView.buffer, offset, chunkLength);
                        
                        // 块CRC（4字节）
                        const chunkCRC = dataView.getUint32(offset + chunkLength, false);
                        
                        // 保存块信息
                        chunks.push({
                            type: chunkType,
                            data: chunkData,
                            crc: chunkCRC
                        });
                        
                        // 移动到下一个块
                        offset += chunkLength + 4;
                    }

                    // 移除现有的陀螺仪相关元数据块
                    const filteredChunks = chunks.filter(chunk => {
                        if (chunk.type !== 'tEXt') return true;
                        
                        // 检查tEXt块的关键字
                        const keyword = readNullTerminatedString(chunk.data);
                        return !['Columns', 'Rows', 'Aspect', 'Gyro3D_Columns', 'Gyro3D_Rows', 'Gyro3D_Aspect'].includes(keyword);
                    });

                    // 添加新的元数据块
                    const newChunks = [
                        createPNGTextChunk('Columns', columns.toString()),
                        createPNGTextChunk('Rows', rows.toString()),
                        createPNGTextChunk('Aspect', aspect.toString()),
                        createPNGTextChunk('Gyro3D_Columns', columns.toString()),
                        createPNGTextChunk('Gyro3D_Rows', rows.toString()),
                        createPNGTextChunk('Gyro3D_Aspect', aspect.toString())
                    ];

                    // 将新块插入到IDAT块之前
                    const idatIndex = filteredChunks.findIndex(chunk => chunk.type === 'IDAT');
                    if (idatIndex > 0) {
                        filteredChunks.splice(idatIndex, 0, ...newChunks);
                    } else {
                        // 如果没有IDAT块（不应该发生），则添加到末尾
                        filteredChunks.push(...newChunks);
                    }

                    // 重新构建PNG文件
                    const pngBuffer = buildPNGFile(filteredChunks);
                    const blob = new Blob([pngBuffer], { type: 'image/png' });
                    resolve(blob);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (e) => reject(e);
            reader.readAsArrayBuffer(file);
        });
    }

    // 写入JPEG图片的元数据
    async function writeJPEGMetadata(file, columns, rows, aspect) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const arrayBuffer = e.target.result;
                    const dataView = new DataView(arrayBuffer);
                    
                    // 验证JPEG文件
                    if (dataView.getUint8(0) !== 0xFF || dataView.getUint8(1) !== 0xD8) {
                        throw new Error('不是有效的JPEG文件');
                    }

                    // 简化实现：对于JPEG图片，我们将在文件末尾添加注释
                    // 创建注释段（APP1段的简化形式）
                    const comment = `Gyro3D Data: Columns=${columns}, Rows=${rows}, Aspect=${aspect}`;
                    const commentBytes = new TextEncoder().encode(comment);
                    
                    // 计算注释段大小（包括注释内容和标记）
                    const commentSize = commentBytes.length + 2; // 2字节的注释标记
                    
                    // 创建一个新的数组缓冲区，包含原始JPEG数据和新的注释
                    const newBuffer = new ArrayBuffer(arrayBuffer.byteLength + commentSize + 4); // 4字节的段头和标记
                    const newDataView = new DataView(newBuffer);
                    
                    // 复制原始JPEG数据（不包括EOF标记）
                    const originalData = new Uint8Array(arrayBuffer);
                    let eofIndex = originalData.length;
                    if (originalData[originalData.length - 2] === 0xFF && originalData[originalData.length - 1] === 0xD9) {
                        eofIndex = originalData.length - 2;
                    }
                    
                    const originalUint8 = new Uint8Array(arrayBuffer, 0, eofIndex);
                    new Uint8Array(newBuffer, 0, eofIndex).set(originalUint8);
                    
                    // 添加注释段
                    let offset = eofIndex;
                    
                    // 注释段标记 (0xFF 0xFE)
                    newDataView.setUint8(offset++, 0xFF);
                    newDataView.setUint8(offset++, 0xFE);
                    
                    // 段大小（包括注释内容，不包括标记）
                    newDataView.setUint16(offset, commentSize, false); // 大端字节序
                    offset += 2;
                    
                    // 注释内容
                    new Uint8Array(newBuffer, offset, commentBytes.length).set(commentBytes);
                    offset += commentBytes.length;
                    
                    // 添加NULL终止符
                    newDataView.setUint8(offset++, 0x00);
                    
                    // 添加EOF标记
                    newDataView.setUint8(offset++, 0xFF);
                    newDataView.setUint8(offset++, 0xD9);
                    
                    const blob = new Blob([newBuffer], { type: 'image/jpeg' });
                    resolve(blob);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (e) => reject(e);
            reader.readAsArrayBuffer(file);
        });
    }

    // 创建PNG文本块
    function createPNGTextChunk(keyword, value) {
        // 创建数据：关键字 + NULL + 值
        const keywordBytes = new TextEncoder().encode(keyword);
        const valueBytes = new TextEncoder().encode(value);
        const data = new Uint8Array(keywordBytes.length + 1 + valueBytes.length);
        
        // 复制关键字
        data.set(keywordBytes);
        // 添加NULL分隔符
        data[keywordBytes.length] = 0x00;
        // 复制值
        data.set(valueBytes, keywordBytes.length + 1);
        
        // 计算CRC
        const chunkTypeBytes = new TextEncoder().encode('tEXt');
        const crcData = new Uint8Array(chunkTypeBytes.length + data.length);
        crcData.set(chunkTypeBytes);
        crcData.set(data, chunkTypeBytes.length);
        const crc = calculatePNGCRC(crcData);
        
        return {
            type: 'tEXt',
            data: data,
            crc: crc
        };
    }

    // 读取以NULL结尾的字符串
    function readNullTerminatedString(data) {
        let result = '';
        for (let i = 0; i < data.length; i++) {
            if (data[i] === 0x00) break;
            result += String.fromCharCode(data[i]);
        }
        return result;
    }

    // 计算PNG块的CRC
    function calculatePNGCRC(data) {
        // PNG CRC算法的简单实现
        let crc = 0xFFFFFFFF;
        const crcTable = createCRCTable();
        
        for (let i = 0; i < data.length; i++) {
            const byte = data[i];
            crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xFF];
        }
        
        return crc ^ 0xFFFFFFFF;
    }

    // 创建CRC表
    function createCRCTable() {
        const crcTable = new Uint32Array(256);
        
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let j = 0; j < 8; j++) {
                c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            }
            crcTable[i] = c;
        }
        
        return crcTable;
    }

    // 构建PNG文件
    function buildPNGFile(chunks) {
        // 计算总文件大小
        const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        let totalSize = pngSignature.length;
        
        chunks.forEach(chunk => {
            totalSize += 4; // 块长度
            totalSize += 4; // 块类型
            totalSize += chunk.data.length; // 块数据
            totalSize += 4; // 块CRC
        });
        
        // 创建文件缓冲区
        const buffer = new ArrayBuffer(totalSize);
        const dataView = new DataView(buffer);
        let offset = 0;
        
        // 写入PNG签名
        pngSignature.forEach(byte => {
            dataView.setUint8(offset++, byte);
        });
        
        // 写入所有块
        chunks.forEach(chunk => {
            // 写入块长度
            dataView.setUint32(offset, chunk.data.length, false);
            offset += 4;
            
            // 写入块类型
            const typeBytes = new TextEncoder().encode(chunk.type);
            for (let i = 0; i < 4; i++) {
                dataView.setUint8(offset++, typeBytes[i]);
            }
            
            // 写入块数据
            const chunkUint8 = new Uint8Array(chunk.data);
            new Uint8Array(buffer, offset, chunk.data.length).set(chunkUint8);
            offset += chunk.data.length;
            
            // 写入块CRC
            dataView.setUint32(offset, chunk.crc, false);
            offset += 4;
        });
        
        return buffer;
    }

    // 下载图片
    function downloadImage(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
});