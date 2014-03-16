
var demo = null,
    CANVAS_WIDTH = 2*320,
    CANVAS_HEIGHT = 2*160;

function $(id) { return document.getElementById(id); }

var imgLeft = new Image(),
    imgRight = new Image(),
    canvas = $('canvas1'),
    canvasDepth = $('canvas2'),
    canvasFrame = null;


// load image in canvas
imgLeft.onload = imgRight.onload = function(){
    this.isReady = true;
    if (imgLeft.isReady && imgRight.isReady) {
        start();
    }
};

imgLeft.src = 'snapshots/pair3/left-small.jpg';
imgRight.src = 'snapshots/pair3/right-small.jpg';

function start() {

    CANVAS_WIDTH = 2*imgLeft.width;
    CANVAS_HEIGHT = imgLeft.height;

    canvasFrame = new CanvasFrame(canvas);

    if (!demo) {
        demo = {
            OFFSET_X: -152,
            OFFSET_Y: 20,
            EPIPOLES_OFFSET_X: -152,
            EPIPOLES_OFFSET_Y: 20,
            SCAN_PARALLAX: 9,
            SCAN_RADIUS: 4,
            SCAN_STEP: 6,
            GRID_FACTOR: 1,
            STOCASTIC_RATIO: 0.75,
            DEPTH_SATURATION: 1,
            DEPTH_SCALE: -0.5,
            PROCESSING_RATIO: 2,
            SIMPLE_BLUR: false,
            GAUSSIAN_BLUR: 0,
            AUTO_TRANSFORM: false,
            webGLRender: function () {
                if (demo) {
                    if (!window.initialized) {
                        window.init();
                        window.animate();
                        window.initialized = true;
                    }
                }
            },
            COLOR_THRESHOLD: 60,
            SCAN_MAX_OFFSET: 5,
            SCAN_OFFSET_STEP: 2,
        };
        gui = new dat.GUI({ width: 400 });
        gui.add(demo, 'OFFSET_X', - CANVAS_WIDTH/2, CANVAS_WIDTH/2).step(1);
        gui.add(demo, 'OFFSET_Y', - CANVAS_HEIGHT/4, CANVAS_HEIGHT/4).step(1);
        gui.add(demo, 'EPIPOLES_OFFSET_X', - CANVAS_WIDTH, CANVAS_WIDTH).step(1);
        gui.add(demo, 'EPIPOLES_OFFSET_Y', - CANVAS_HEIGHT/2, CANVAS_HEIGHT/2).step(1);
        gui.add(demo, 'SCAN_PARALLAX', 2, 80).step(1);
        gui.add(demo, 'SCAN_RADIUS', 1, 80).step(1);
        gui.add(demo, 'SCAN_STEP', 1, 10).step(1);
        gui.add(demo, 'GRID_FACTOR', 1, 40).step(1);
        gui.add(demo, 'STOCASTIC_RATIO', 0, 1).step(0.0001);
        gui.add(demo, 'DEPTH_SATURATION', 0, 10).step(0.0001);
        gui.add(demo, 'DEPTH_SCALE', -2, 2).step(0.0011);
        gui.add(demo, 'PROCESSING_RATIO', 1, 30).step(1);
        gui.add(demo, 'SIMPLE_BLUR');
        gui.add(demo, 'GAUSSIAN_BLUR', 0, 10).step(1);
        gui.add(demo, 'AUTO_TRANSFORM');
        gui.add(canvasFrame, 'transform');
        gui.add(demo, 'webGLRender');

            gui.add(demo, 'COLOR_THRESHOLD', 0, 255).step(1);
            gui.add(demo, 'SCAN_MAX_OFFSET', 2, 80).step(1);
            gui.add(demo, 'SCAN_OFFSET_STEP', 1, 10).step(1);
    }

    canvasFrame.context.drawImage(imgLeft, 0, 0, imgLeft.width, imgLeft.height);
    canvasFrame.context.drawImage(imgRight, imgLeft.width, 0, imgRight.width, imgRight.height);

    canvasFrame.original = canvasFrame.context.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    canvasFrame.buffer = canvasFrame.context.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
    canvasFrame.buffer.data.set(canvasFrame.original.data);

    function paintOnCanvas() {
        canvasFrame.context.putImageData(canvasFrame.original, 0, 0);
        if (demo.AUTO_TRANSFORM) {
            canvasFrame.transform();
        }
        if (window.initialized) {
            updateHeightmap();
        }
        setTimeout(paintOnCanvas, 100);
    }
    paintOnCanvas();
};


var distance2 = function (v1, v2, i) {
    return Math.sqrt(Math.pow(v1[i+0] - v2[i+0], 2) + Math.pow(v1[i+1] - v2[i+1], 2));
};

var distance3 = function (v1, v2, i) {
    return Math.sqrt(Math.pow(v1[i+0] - v2[i+0], 2) + Math.pow(v1[i+1] - v2[i+1], 2) + Math.pow(v1[i+2] - v2[i+2], 2));
};

function CanvasFrame(canvas) {
    var that = this;

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    this.context = canvas.getContext('2d');

    canvasDepth.width = CANVAS_WIDTH/2;
    canvasDepth.height = CANVAS_HEIGHT;
    this.depthContext = canvasDepth.getContext('2d');

    // initialize variables
    this.buffer = this.context.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
    this.renderFrameCounter = 0;
}

CanvasFrame.prototype.transform = function() {


    var imagedata = this.original,
        imagepx = imagedata.data,
        newdata = this.buffer,
        newpx = newdata.data,
        len = newpx.length;

    var i = l = x = y = 0, w = CANVAS_WIDTH, h = CANVAS_HEIGHT,
        j, xr, yr, k,
        diff, diffnew, xk, yk, jr, jl, besthit, step = demo.SCAN_STEP, parallax = demo.SCAN_PARALLAX, radius = demo.SCAN_RADIUS;


    var ctx = this.context;


    // iterate through the entire buffer
    for (i = 0; i < len; i += 4) {

        newpx[i+3] = 255;

        x = (i/4) % w;
        // only with the left side image...
        if (x < CANVAS_WIDTH/2) {
            y = parseInt((i/4) / w);
            if (!(x % demo.GRID_FACTOR) && !(y % demo.GRID_FACTOR) && Math.random() > demo.STOCASTIC_RATIO) {

                /// old gbort's scanning using epipoles without previous transformation needed
                Dx = x - demo.EPIPOLES_OFFSET_X;
                Dy = y - h/2 + demo.EPIPOLES_OFFSET_Y;
                m = Dy/Dx;
                d = y - m*(x + w/2);
                fscan = function (xi) { return (m*(xi + demo.EPIPOLES_OFFSET_X) + d); };

                minD = Number.MAX_VALUE;
                count = 0;
                // default is full depth
                depth = 1;

                // pick the left side pixel color
                cl = [imagepx[i+0], imagepx[i+1], imagepx[i+2]];

                for (dx = demo.SCAN_MAX_OFFSET; dx > -demo.SCAN_MAX_OFFSET; dx-=demo.SCAN_OFFSET_STEP) {
                    xr = w/2 + x - demo.OFFSET_X  + dx;
                    yr = parseInt(fscan(xr), 10) - demo.OFFSET_Y;
                    if (xr < w/2 || xr > w || yr < 0 || yr > h) continue;
                    j = (yr*w + xr)*4;

                    if (Math.random() > 0.9999) {
                        ctx.beginPath();
                        ctx.moveTo(x+w/2, y);
                        ctx.lineTo(xr, yr);
                        ctx.closePath();
                        ctx.lineWidth = 1;
                        ctx.strokeStyle = '#f00';
                        ctx.stroke();
                        
                    }

                    // pick the right side scanning pixel color
                    cr = [imagepx[j+0], imagepx[j+1], imagepx[j+2]];

                    // if it matches then draw in the depthmap 
                    if ((distance = distance3(cl, cr, 0)) < minD) {
                        count++;
                        // estimate depth from 0 to 1 (higher is deeper)
                        depth = 1/(2*demo.SCAN_MAX_OFFSET) * (Math.abs(dx) + demo.SCAN_MAX_OFFSET);
                        minD = distance;
                        if (count > demo.SCAN_MAX_OFFSET || minD < demo.COLOR_THRESHOLD) {
                            //break;
                        }
                    }
                }
                if (minD > 0 && minD < demo.COLOR_THRESHOLD) {
                    depth = depth * (demo.COLOR_THRESHOLD/(minD + demo.COLOR_THRESHOLD));
                }
                // apply depth saturation if <> 1
                depth *= demo.DEPTH_SATURATION;
                depth = depth > 1 ? 1 : depth;

                // draw depth canvas buffer
                colorDepth = parseInt(depth*255, 10);
                newpx[i+0] = colorDepth;
                newpx[i+1] = colorDepth;
                newpx[i+2] = colorDepth;
                newpx[i+3] = 255;
                

                /*
                //// elsamuko's stereo algorithm for already transformed images
                xr = w/2 + x;
                yr = y;

                //Algorithm begins here:
                diff = Number.MAX_VALUE;
                diffnew = 0;
                besthit = 0;
                //search at the left side for the best fit
                for ( j = 0; j > -parallax; j-- ) {
                    diffnew = 0;
                    for ( xk = -radius; xk <= radius; xk+=step ) {
                        for ( yk = -radius; yk <= radius; yk+=step ) {
                            jr = ((yr + yk)*w + j + xr + xk)*4;
                            jl = ((y + yk)*w + x + xk)*4;
                            diffnew += (
                                Math.abs(imagepx[jr] - imagepx[jl])
                                + Math.abs(imagepx[jr + 1] - imagepx[jl + 1])
                                + Math.abs(imagepx[jr + 2] - imagepx[jl + 2])
                            );
                        }
                    }
                    //set besthit, if the new diff is lower than old diff
                    if ( diffnew < diff ) {
                        besthit = -j;
                        diff = diffnew;
                    } else {
                        break;
                    }
                }
                besthit = parseInt(255 * besthit/parallax, 10);
                j = i;// /demo.GRID_FACTOR;
                //set depth
                newpx[j+0] = besthit;
                newpx[j+1] = besthit;
                newpx[j+2] = besthit;
                newpx[j+3] = 255;
                */
            } else {
                newpx[i+0] = 100;
                newpx[i+1] = 100;
                newpx[i+2] = 100;
                newpx[i+3] = 255;
            }
        }
    }
    if (demo.SIMPLE_BLUR) {
        Filter.blur(newdata);
    }
    this.depthContext.putImageData(newdata, 0, 0);
    if (demo.GAUSSIAN_BLUR > 0) {
        stackBlurCanvasRGB('canvas2', 0, 0, canvasDepth.width, canvasDepth.height, demo.GAUSSIAN_BLUR);
    }

};

