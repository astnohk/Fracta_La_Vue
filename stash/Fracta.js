// The code written in BSD/KNF indent style
"use strict";

class FractaLaVue {
	constructor(windowSystemRoot, rootWindow) {
		this.SysRoot = windowSystemRoot;
		this.rootWindow = rootWindow;
		this.rootWindow.style.overflow = "hidden";
		this.rootWindow.rootInstance = this;
		this.rootWindowStyle = window.getComputedStyle(this.rootWindow);
		this.loopEnded = true;
		this.initFlag = false;

		this.canvasWidth = 800;
		this.canvasHeight = 800;

		this.fractalMap = [];
		this.fractalTimeStep = 5;
		this.fractalTimeMax = 10000;
		this.fractalTimeCurrent = 0;

		this.touchCounter = 0;
		this.touchCounting = false;

		this.colorDisplayButton = null;
		this.fractalModeButton = null;
		this.colorDisplay = 0;
		this.fractalMode = "Mandelbrot_normal";
		this.JuliaC = {re: -0.8, im: 0.156};
		this.JuliaFunctionOrdinary = function (z, c) {
			return this.c_plus(this.c_mult(z, z), c);
		};
		this.JuliaFunctionNewton = function (z, c) {
			return this.c_plus(
				this.c_mult({re: 2/3, im: 0}, z),
				this.c_div({re: 1/3, im: 0}, this.c_mult(z, z)));
		};
		this.JuliaFunction = this.JuliaFunctionOrdinary;
		this.fractalModeDisplayEqMandelbrot_normal =
		    "<math>" +
		    "<msub><mi>z</mi><mrow><mi>n</mi><mo>+</mo><mn>1</mn></mrow></msub><mo>=</mo>" +
		    "<msub><mi>z</mi><mi>n</mi></msub><mo>+</mo><mi>c</mi>" +
		    "</math>" + "," +
		    "<br>" +
		    "<math>" +
		    "<mi>c</mi><mo>=</mo>" +
		    "<mi>x</mi><mo>+</mo><mi>i</mi><mi>y</mi>" +
		    "</math>";

		this.timeClock = null;

		this.colormap = null;
		this.bitmap = null;
		this.canvas = null;
		this.context = null;
		this.viewScale = Math.max(this.canvasWidth, this.canvasHeight) / 4.0;
		this.viewScaleStep = 0.5;

		this.camera = {
			pos: {x: 0.0, y: 0.0, z: 0.0},
		};

		this.prev_mouse = {x: 0, y: 0};
		this.prev_touches = [];

		// Initialize
		this.init();
	}

// ----- Initialize -----
	init()
	{
		// Initialize colormap
		this.initColormap(256);
		// Initialize canvas
		this.prepareCanvas();
		// Set event listener
		this.rootWindow.addEventListener("keydown", function (e) { e.currentTarget.rootInstance.keyDown(e); }, false);
		this.rootWindow.addEventListener("wheel", function (e) { e.currentTarget.rootInstance.wheelMove(e); }, false);
		// Create UI parts
		this.prepareTools();

		// Set initial position and velocity
		this.initFractal();

		// Start loop
		this.startLoop();
	}

	startLoop()
	{
		let root = this;
		this.timeClock = setInterval(function () { root.loop(); }, 100);
	}

	prepareCanvas()
	{
		// Initialize canvas
		this.canvas = document.createElement("canvas");
		this.canvas.rootInstance = this;
		this.canvas.id = "FractaLaVueMainPool";
		this.canvas.style.width = this.canvasWidth + "px";
		this.canvas.style.height = this.canvasHeight + "px";
		this.rootWindow.appendChild(this.canvas);
		this.canvas.addEventListener(
		    "windowdrag",
		    function (e) {
			    let style = window.getComputedStyle(e.currentTarget);
			    e.currentTarget.width = parseInt(style.width, 10);
			    e.currentTarget.height = parseInt(style.height, 10);
			    let root = e.currentTarget.rootInstance;
			    root.displayOffset.x = e.currentTarget.width / 2.0;
			    root.displayOffset.y = e.currentTarget.height / 2.0;
		    },
		    false);
		this.canvas.addEventListener("mousedown", function (e) { e.currentTarget.rootInstance.mouseClick(e); }, false);
		this.canvas.addEventListener("mousemove", function (e) { e.currentTarget.rootInstance.mouseMove(e); }, false);
		this.canvas.addEventListener("touchstart", function (e) { e.currentTarget.rootInstance.mouseClick(e); }, false);
		this.canvas.addEventListener("touchmove", function (e) { e.currentTarget.rootInstance.mouseMove(e); }, false);
		this.canvas.addEventListener("dblclick", function (e) { e.currentTarget.rootInstance.mouseDblClick(e); }, false);
		this.context = this.canvas.getContext("2d");
		// Initialize canvas size
		let canvasStyle = window.getComputedStyle(this.canvas);
		this.canvas.width = parseInt(canvasStyle.width, 10);
		this.canvas.height = parseInt(canvasStyle.height, 10);
		// Initialize bitmap
		this.bitmap = this.context.createImageData(this.canvas.width, this.canvas.height);
		// Set alpha of all pixels equal to 1.0
		for (let i = 0; i < this.canvas.width * this.canvas.height; i++) {
			this.bitmap.data[4 * i + 3] = 255;
		}
	}

	prepareTools()
	{
		this.colorDisplayButton = document.createElement("div");
		this.colorDisplayButton.rootInstance = this;
		this.colorDisplayButton.innerHTML = "monochrome";
		this.colorDisplayButton.id = "FractaLaVueColorDisplayButton";
		this.colorDisplayButton.addEventListener("mousedown", function (e) { e.preventDefault(); e.currentTarget.rootInstance.switchColorDisplay(e); }, false);
		this.colorDisplayButton.addEventListener("touchstart", function (e) { e.preventDefault(); e.currentTarget.rootInstance.switchColorDisplay(e); }, false);
		this.rootWindow.appendChild(this.colorDisplayButton);

		this.fractalModeButton = document.createElement("div");
		this.fractalModeButton.rootInstance = this;
		this.fractalModeButton.innerHTML = this.fractalModeDisplayEqMandelbrot_normal;
		this.fractalModeButton.id = "FractaLaVueFractalModeButton";
		this.fractalModeButton.addEventListener("mousedown", function (e) { e.preventDefault(); e.currentTarget.rootInstance.switchCalcCMode(e); }, false);
		this.fractalModeButton.addEventListener("touchstart", function (e) { e.preventDefault(); e.currentTarget.rootInstance.switchCalcCMode(e); }, false);
		this.rootWindow.appendChild(this.fractalModeButton);
	}

	initFractal() {
		this.fractalTimeCurrent = 0;
		if (this.fractalMode.indexOf("Julia") == 0) {
			for (let m = 0; m < this.canvas.height; m++) {
				for (let n = 0; n < this.canvas.width; n++) {
					this.fractalMap[this.canvas.width * m + n] = {
							t: 0,
							z: {
								re: this.camera.pos.x + (n - this.canvas.width / 2.0) / this.viewScale,
								im: this.camera.pos.y + (m - this.canvas.height / 2.0) / this.viewScale
							}
						};
				}
			}
		} else { // Mandelbrot
			for (let i = 0; i < this.canvas.height * this.canvas.width; i++) {
				this.fractalMap[i] = {
					t: 0,
					z: {re: 0, im: 0}};
			}
		}
	}

	initColormap(length)
	{
		this.colormap = [];
		let S = 0.6;
		let V = 1.0;
		for (let i = 0; i < length; i++) {
			this.colormap.push(
				this.HSV2RGB(i / length * 360.0, S, V));
		}
	}
	
	HSV2RGB(H, S, V)
	{
		if (H < 0) {
			H = (H % 360) + 360;
		}
		let angle = (H % 360) / 60.0;
		let C = S;
		let X = C * (1 - Math.abs((angle % 2) - 1));
		let color = {
			R: V - C,
			G: V - C,
			B: V - C};
		if (S > 0) {
			switch (Math.floor(angle)) {
				case 0:
					color.R += C;
					color.G += X;
					break;
				case 1:
					color.R += X;
					color.G += C
					break;
				case 2:
					color.G += C;
					color.B += X;
					break;
				case 3:
					color.G += X;
					color.B += C;
					break;
				case 4:
					color.R += X;
					color.B += C;
					break;
				case 5:
					color.R += C;
					color.B += X;
					break;
			}
		}

		color.R = Math.floor(255 * color.R);
		color.G = Math.floor(255 * color.G);
		color.B = Math.floor(255 * color.B);
		return color;
	}



	// ----- Start Simulation -----
	loop()
	{
		if (!this.loopEnded) {
			return;
		}
		if (this.initFlag) {
			this.initFlag = false;
			this.initFractal();
		}
		if (this.fractalMode.indexOf("Julia") == 0) {
			this.calculateJulia();
		} else {
			this.calculate();
		}
		this.draw();
		this.loopEnded = true;
	}



	// ----- REALTIME -----
	calculate()
	{
		for (let t = 0; t < this.fractalTimeStep; t++) {
			this.fractalTimeCurrent += 1;
			for (let m = 0; m < this.canvas.height; m++) {
				for (let n = 0; n < this.canvas.width; n++) {
					let z = this.fractalMap[this.canvas.width * m + n].z;
					let zp = this.c_plus(
						this.c_mult(z, z),
						this.c_getC({
							re: this.camera.pos.x + (n - this.canvas.width / 2.0) / this.viewScale,
							im: this.camera.pos.y + (m - this.canvas.height / 2.0) / this.viewScale
						}, this.fractalMode));
					if (this.c_abs(zp) < 2.0) {
						this.fractalMap[this.canvas.width * m + n].t += 1;
					}
					this.fractalMap[this.canvas.width * m + n].z = zp;
				}
			}
		}
	}

	calculateJulia()
	{
		for (let t = 0; t < this.fractalTimeStep; t++) {
			this.fractalTimeCurrent += 1;
			for (let m = 0; m < this.canvas.height; m++) {
				for (let n = 0; n < this.canvas.width; n++) {
					let z = this.fractalMap[this.canvas.width * m + n].z;
					let zp = this.JuliaFunction(z, this.JuliaC);
					if (this.c_abs(zp) < 2.0 && this.c_abs(this.c_minus(zp, z)) > 1e-0) {
						this.fractalMap[this.canvas.width * m + n].t += 1;
					}
					this.fractalMap[this.canvas.width * m + n].z = zp;
				}
			}
		}
	}

	c_plus(z1, z2)
	{
		return {re: z1.re + z2.re, im: z1.im + z2.im};
	}

	c_minus(z1, z2)
	{
		return {re: z1.re - z2.re, im: z1.im - z2.im};
	}

	c_mult(z1, z2)
	{
		return {re: z1.re * z2.re - z1.im * z2.im,
			im: z1.im * z2.re + z1.re * z2.im};
	}

	c_div(z1, z2)
	{
		let r = z2.re * z2.re + z2.im * z2.im;
		return {re: (z1.re * z2.re + z1.im * z2.im) / r,
			im: (z1.im * z2.re - z1.re * z2.im) / r};
	}

	c_abs(z)
	{
		return Math.sqrt(z.re * z.re + z.im * z.im);
	}

	c_getC(z, mode)
	{
		if (mode === "Mandelbrot_exp") {
			let r = Math.exp(z.re);
			return {re: r * Math.cos(z.im),
				im: r * Math.sin(z.im)};
		} else if (mode === "Mandelbrot_z^2") {
			return this.c_mult(z, z);
		} else { // "Mandelbrot_normal"
			return {re: z.re,
				im: z.im};
		}
	}

	draw()
	{
		this.drawPlane(this.camera);
	}

	drawPlane(camera)
	{
		for (let m = 0; m < this.canvas.height; m++) {
			for (let n = 0; n < this.canvas.width; n++) {
				if (this.c_abs(this.fractalMap[this.canvas.width * m + n].z) < 2.0) {
					let intensity = 255;
					if (this.colorDisplay == 2) {
						intensity = 0;
					}
					this.bitmap.data[4 * (this.canvas.width * m + n)] = intensity;
					this.bitmap.data[4 * (this.canvas.width * m + n) + 1] = intensity;
					this.bitmap.data[4 * (this.canvas.width * m + n) + 2] = intensity;
				} else {
					let val = Math.pow(this.fractalMap[this.canvas.width * m + n].t / this.fractalTimeCurrent, 0.3);
					if (val > 1.0) {
						val = 1 - 1e-6;
					}
					let color;
					if (this.colorDisplay > 0) {
						let pcolor = this.colormap[Math.floor(2 * val * this.colormap.length) % this.colormap.length];
						if (this.colorDisplay == 2) {
							color = {
								R: 255 - pcolor.R,
								G: 255 - pcolor.G,
								B: 255 - pcolor.B};
						} else {
							color = {
								R: pcolor.R,
								G: pcolor.G,
								B: pcolor.B};
						}
					} else {
						let tmp = Math.floor(255 * val);
						color = {
							R: tmp,
							G: tmp,
							B: tmp};
					}
					this.bitmap.data[4 * (this.canvas.width * m + n)] = color.R;
					this.bitmap.data[4 * (this.canvas.width * m + n) + 1] = color.G;
					this.bitmap.data[4 * (this.canvas.width * m + n) + 2] = color.B;
				}
			}
		}
		this.context.putImageData(this.bitmap, 0, 0);
	}

	moveCamera(x, y, zoom)
	{
		this.camera.pos.x += x;
		this.camera.pos.y += y;
		if (zoom != 0) {
			this.viewScale *= zoom;
		}
		// Init fractal because the map can't scale correctly
		this.initFlag = true;
	}

	mouseClick(event)
	{
		event.preventDefault();
		let root = this;
		if (event.type === "mousedown") {
			//this.prev_mouse = {clientX: event.clientX, clientY: event.clientY};
			this.prev_mouse = this.pointerPositionDecoder(event);
		} else if (event.type === "touchstart") {
			let touches_current = Array.from(event.touches);
			this.prev_touches = touches_current.map(this.extractTouches, this);
			if (this.touchCounting && event.touches.length == 1) {
				this.touchDblTap(event);
			}
			if (event.touches.length == 1) {
				// Set touchCounting should be at end of event processing
				this.touchCounting = true;
				clearTimeout(this.touchCounter);
				this.touchCounter = setTimeout(function () { root.touchCounting = false; }, 200);
			}
		}
	}

	mouseMove(event)
	{
		event.preventDefault();
		if (event.type === "mousemove") {
			let pointer = this.pointerPositionDecoder(event);
			let move = {x: 0, y: 0};
			move.x = (pointer.x - this.prev_mouse.x) / this.viewScale;
			move.y = (pointer.y - this.prev_mouse.y) / this.viewScale;
			if ((event.buttons & 1) != 0) {
				// Invert signs because we want move the plane
				this.moveCamera(-move.x, -move.y, 0);
			}
			this.prev_mouse = {x: pointer.x, y: pointer.y};
		} else if (event.type === "touchmove") {
			let touches_current = Array.from(event.touches);
			let move = {x: 0, y: 0};
			if (touches_current.length == 1) {
				let pointer = this.pointerPositionDecoder(touches_current[0]);
				let n = this.prev_touches.findIndex(function (element, index, touches) {
					if (element.identifier == this[0].identifier) {
						return true;
					} else {
						return false;
					}
				    },
				    touches_current);
				if (n >= 0) {
					move.x = (pointer.x - this.prev_touches[n].x) / this.viewScale;
					move.y = (pointer.y - this.prev_touches[n].y) / this.viewScale;
					//this.rotCamera(
					//    -2.0 * Math.PI * move.x / this.rotDegree,
					//    2.0 * Math.PI * move.y / this.rotDegree);
				}
			} else if (touches_current.length == 2 && this.prev_touches.length == 2) {
				let p0 = this.prev_touches[0];
				let p1 = this.prev_touches[1];
				let r0 = this.pointerPositionDecoder(touches_current[0]);
				let r1 = this.pointerPositionDecoder(touches_current[1]);
				move.x = ((r0.x + r1.x) - (p0.x + p1.x)) * 0.5 / this.viewScale;
				move.y = ((r0.y + r1.y) - (p0.y + p1.y)) * 0.5 / this.viewScale;
				let dp = Math.sqrt(Math.pow(p0.x - p1.x, 2) + Math.pow(p0.y - p1.y, 2));
				let d = Math.sqrt(Math.pow(r0.x - r1.x, 2) + Math.pow(r0.y - r1.y, 2));
				// Invert signs because we want move the plane
				this.moveCamera(-move.x, -move.y, 1 + Math.sign(d - dp) * this.viewScaleStep);
			}
			this.prev_touches = touches_current.map(this.extractTouches, this);
		}
	}

	pointerPositionDecoder(pointer)
	{
		let rect = this.rootWindow.getBoundingClientRect();
		let pos = {
			x: pointer.clientX - rect.left,
			y: pointer.clientY - rect.top
		};
		return pos;
	}

	extractTouches(a)
	{
		let pos = this.pointerPositionDecoder(a);
		return {x: pos.x, y: pos.y, identifier: a.identifier};
	}

	mouseDblClick(event)
	{
		event.preventDefault();
		this.chaseBHInvoked = true;
		this.chasingBHDistanceCurrent = this.chaseBHDistance;
		this.chaseBHClickedPos = this.pointerPositionDecoder(event);
	}

	touchDblTap(event)
	{
		this.chaseBHInvoked = true;
		this.chasingBHDistanceCurrent = this.chaseBHDistance;
		this.chaseBHClickedPos = this.pointerPositionDecoder(event.touches[0]);
	}

	wheelMove(e)
	{
		event.preventDefault();
		this.moveCamera(0, 0, 1 - Math.sign(event.deltaY) * this.viewScaleStep);
	}

	keyDown(event)
	{
		switch (event.key) {
			case "ArrowUp":
				break;
			case "ArrowDown":
				break;
			case "ArrowLeft":
				break;
			case "ArrowRight":
				break;
		}
	}

	switchColorDisplay()
	{
		this.colorDisplay = (this.colorDisplay + 1) % 3;
		switch (this.colorDisplay) {
			case 0:
				this.colorDisplayButton.innerHTML = "monochrome";
				break;
			case 1:
				this.colorDisplayButton.innerHTML = "color";
				break;
			case 2:
				this.colorDisplayButton.innerHTML = "color neg";
		}
	}

	switchCalcCMode()
	{
		switch (this.fractalMode) {
			case "Mandelbrot_normal":
				this.fractalMode = "Mandelbrot_exp";
				this.fractalModeButton.innerHTML =
				    "<math>" +
				    "<msub><mi>z</mi><mrow><mi>n</mi><mo>+</mo><mn>1</mn></mrow></msub><mo>=</mo>" +
				    "<msub><mi>z</mi><mi>n</mi></msub><mo>+</mo><mi>c</mi>" +
				    "</math>" + "," +
				    "<br>" +
				    "<math>" +
				    "<mi>c</mi><mo>=</mo>" +
				    "<mi>exp</mi><mo>&ApplyFunction;</mo><mrow><mo>(</mo><mi>x</mi><mo>+</mo><mi>i</mi><mi>y</mi><mo>)</mo></mrow>" +
				    "</math>";
				break;
			case "Mandelbrot_exp":
				this.fractalMode = "Mandelbrot_z^2";
				this.fractalModeButton.innerHTML =
				    "<math>" +
				    "<msub><mi>z</mi><mrow><mi>n</mi><mo>+</mo><mn>1</mn></mrow></msub><mo>=</mo>" +
				    "<msub><mi>z</mi><mi>n</mi></msub><mo>+</mo><mi>c</mi>" +
				    "</math>" + "," +
				    "<br>" +
				    "<math>" +
				    "<mi>c</mi><mo>=</mo>" +
				    "<msup><mrow><mo>(</mo><mi>x</mi><mo>+</mo><mi>i</mi><mi>y</mi><mo>)</mo></mrow><mn>2</mn></msup>" +
				    "</math>";
				break;
			case "Mandelbrot_z^2":
				this.fractalMode = "Julia";
				this.fractalModeButton.innerHTML = "Julia set of<br><math>" +
				    "<mi>f</mi><mo>&ApplyFunction;</mo><mrow><mo>(</mo><mi>z</mi><mo>)</mo></mrow>" +
				    "<mo>=</mo>" +
				    "<msup><mi>z</mi><mn>2</mn></msup><mo>+</mo><mo>(</mo><mn>" + this.JuliaC.re + "</mn><mo>" + (this.JuliaC.im > 0 ? "+" : "-") + "</mo><mn>" + Math.abs(this.JuliaC.im) + "</mn><mo>)</mo>" +
				    "</math>";
				break;
			default:
				this.fractalMode = "Mandelbrot_normal";
				this.fractalModeButton.innerHTML = "c = x + i * y";
				this.fractalModeButton.innerHTML = this.fractalModeDisplayEqMandelbrot_normal;
		}
		this.initFlag = true;
	}
}

