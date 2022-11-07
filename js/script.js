import {WebGLMath} from './lib/math.js';

window.addEventListener('DOMContentLoaded', () => {
  const webgl = new WebGLFrame(); // WebGLFrame クラスを生成して インスタンスを生成する
  // ① WebGL コンテキスト取得を試みる
  webgl.init('webgl-canvas');
  // ② シェーダのソースコードを外部ファイルから取得したシェーダソースから shader オブジェクトを生成して、各オブジェクトをプログラムオブジェクトに割り当てます
  // プログラムオブジェクトが生成できたら、対象のプログラムオブジェクトから attribute 変数と uniform 変数のロケーションを取得しておきます
  webgl.load()
  .then(() => {
    // ③ 頂点属性をVBOに変換、背景色の指定、セットアップ完了時刻のタイムスタンプを取得する
    webgl.setup();
    // ④ いよいよ描画処理に移ります
    webgl.render();
  });
});

class WebGLFrame {
  constructor(){
    this.canvas    = null;  // canvas 要素を格納するプロパティ
    this.gl        = null;  // WebGLRenderingContext APIを格納
    this.running   = false; // requestAnimationFrame関数を再帰的に呼び出すか判定するフラグ
    this.beginTime = 0;     // setup が完了した時刻(タイムスタンプ)
    this.nowTime   = 0;     // 現在の時刻(タイムスタンプ)
    this.render    = this.render.bind(this);
  }

  init(canvas){                                                              // 引数に canvas 要素の id 名を文字列で受け取る
    if(canvas instanceof HTMLCanvasElement){                                 // オブジェクトの種類が、HTMLCanvasElement であるか判断
      this.canvas = canvas;
    } else if(Object.prototype.toString.call(canvas) === '[object String]'){ // 引数がcanvas要素の id名(文字列)である場合
      const c = document.querySelector(`#${canvas}`);                        // DOM要素から canvas 要素を取得する
      if(c instanceof HTMLCanvasElement){                                    // 正しく canvas 要素が取得してきれば
        this.canvas = c;                                                     // canvas プロパティに canvas 要素を格納
      }
    }
    // 
    if(this.canvas == null){
      throw new Error('invalid argument');
    }

    // この時点で正しく、canvas要素を取得しているので、WebGL コンテキスト取得を試みる
    this.gl = this.canvas.getContext('webgl'); // gl プロパティに WebGLRenderingContext  APIを格納

    if(this.gl == null){  // 正しく、API を取得できているがチェックする
      throw new Error('webgl not supported');
    }
  }

  load(){
    this.program     = null; // プログラムオブジェクト
    this.attLocation = null; // attribute 変数のロケーションを格納する配列
    this.attStride   = null; // attribute のストライドを格納する配列
    this.uniLocation = null; // uniform 変数のロケーションを格納する配列
    this.uniType     = null; // uniform 変数のタイプを格納する配列

    return new Promise((resolve) => {
      this.loadShader(['./js/shader/vs1.vert', './js/shader/fs1.frag']) // loadShaderメソッドに配列でshaderのpathを渡す(中身はhtmlから見ての相対パス)
      .then((shaders) => {                                              // 非同期で読み込んだシェーダソースを利用してシェーダオブジェクトを生成する
        // 解決した頂点とフラグメントshaderソースは配列に格納されて返却される
        const gl = this.gl;                                             // webgl API
        const vs = this.createShader(shaders[0], gl.VERTEX_SHADER);     // WebGLShader オブジェクトを格納
        const fs = this.createShader(shaders[1], gl.FRAGMENT_SHADER);   // WebGLShader オブジェクトを格納
        
        // 生成した頂点シェーダとフラグメントシェーダのオブジェクトを、プログラムオブジェクトを生成して関連付けを行う
        this.program = this.createProgram(vs, fs); // WebGLProgram オブジェクトを格納
        // attribute 変数に対応するストライドを配列に格納します
        this.attStride = [ 3, 4 ];
        // 次に、WebGLProgram オブジェクトから attribute location を取得します
        this.attLocation = [
          gl.getAttribLocation(this.program, 'position'),
          gl.getAttribLocation(this.program, 'color'),
        ]; // 取得したロケーションを配列に格納しておきます
        this.attLocation.forEach((attL, index) => {                            // 
          if(attL === -1){                                                     // 取得できなければ -1 が返される為、正しく取得できたかチェックします
            throw new Error('attribute location Failed to retrieve data');
          }
        });

        // uniform 変数に対応するタイプを配列に格納します
        this.uniType = [
          'uniform4fv',
          'uniform2fv',
          'uniform2fv',
          'uniform1f',
          'uniformMatrix4fv',
          'uniform1f',
        ];
        // 続いて、uniform location を WebGLProgram オブジェクトから取得します
        this.uniLocation = [
          gl.getUniformLocation(this.program, 'uColor'),
          gl.getUniformLocation(this.program, 'uResolution'),
          gl.getUniformLocation(this.program, 'uMouse'),
          gl.getUniformLocation(this.program, 'uClientX'),
          gl.getUniformLocation(this.program, 'modelMatrix'),
          gl.getUniformLocation(this.program, 'uFlag'),
        ]; // 取得した WebGLUniformLocation オブジェクトを配列に格納しておきます
        
        this.uniLocation.forEach((uniL, index) => {
          if(uniL == null){ // 取得できなければ null が返されるの為、正しく取得できたかチェックします
            throw new Error('uniform location Failed to retrieve data');
          }
        });

        // ここまで到達すると、問題なく処理が完了できているので Promise を解決しましょう
        resolve();
      })
    });
  }

  loadShader(pathArray){
    if(!Array.isArray(pathArray)){ // Array.isArray() メソッドは、渡された値が Array かどうかを判断します。
      throw new Error('invalid argument');
    }
    const promises = pathArray.map((path) => { // 引数から受け取った配列(path)を fetch関数を使用して promises の配列に promise を格納
      return fetch(path).then((response) => {return response.text()});
    })
    return Promise.all(promises); // fetch関数を使用して取得した promise 配列を全て解決して 返却する
  }

  createShader(source, type){
    if(this.gl == null){
      throw new Error('webgl not initialized');
    }
    const gl = this.gl;                                   // webgl API
    const shader = gl.createShader(type);                 // 空のシェーダオブジェクトを生成する
    gl.shaderSource(shader, source);                      // 今作った空のシェーダオブジェクトにソースコードを割り当てる
    gl.compileShader(shader);                             // コンパイルする
    if(gl.getShaderParameter(shader, gl.COMPILE_STATUS)){ // 正しくコンパイルされたか、コンパイル後のステータスを確認
      return shader;                                      // 問題なければシェーダオブジェクトを返す
    } else {
      alert(gl.getShaderInfoLog(shader));
      return null;
    }
  }

  createProgram(vsObj, fsObj){
    if(this.gl == null){
      throw new Error('webgl not initialized');
    }
    const gl = this.gl;                                   // webgl API
    const program = gl.createProgram();                   // 空のプログラムオブジェクトを生成する
    gl.attachShader(program, vsObj);                      // まず初めにプログラムオブジェクトに頂点シェーダのオブジェクトをアタッチする
    gl.attachShader(program, fsObj);                      // 続いてプログラムオブジェクトにフラグメントシェーダのオブジェクトをアタッチする
    gl.linkProgram(program);                              // ここでプログラムオブジェクトに接続された頂点とフラグメントのシェーダーをリンクさせます。
    if(gl.getProgramParameter(program, gl.LINK_STATUS)){  // 正しくリンクされたか確認しましょう
      gl.useProgram(program);                             // 正しくリンクしていれば指定した WebGLProgram を現在の描画ステートの一部として設定
      return program;                                     // プログラムオブジェクトを返します
    } else {
      alert(gl.getProgramInfoLog(program));
      return null;
    }
  }

  setup(){
    const gl = this.gl; // webgl API
    gl.clearColor(0.9135, 0.9135, 0.9035, 1.0); // 
    this.running = true;              // 
    this.beginTime = Date.now();       //
    this.mouse = {
      x: 0,
      y: 0,
      clientX: 0,
    }
    window.addEventListener('mousemove', (e) => {
      this.mouse.x       = (e.clientX / window.innerWidth)  * 2.0 - 1.0; // [-1, 1.0] の範囲
      this.mouse.y       = (e.clientY / window.innerHeight) * 2.0 - 1.0; // [-1, 1.0] の範囲
      this.mouse.clientX = e.clientX  / window.innerWidth;               // [ 0, 1.0] の範囲
    });

    // @@@ インターリーブ
    this.attSAmount = null;
    this.attStride.forEach((stride, index) => {
      this.attSAmount += stride; // 合計 7
    });

    this.p                 = []; // 10000の頂点座標となるデータの配列
    this.c                 = []; // 10000の頂点色となるデータの配列
    this.vertextBufferData = []; // @@@ インターリーブ
    for(let i = 0; i < 10000; i++){
      const angle = Math.PI*2;
      const deg   = Math.random() * (angle - 0) + 0;
      const r     = Math.sqrt(Math.random());
      const x     =  r * 0.5 * Math.cos(deg);
      const y     =  r * 0.5 * Math.sin(deg);
      const z     = 0.0;
      this.p.push(x, y, z);
      this.c.push(0.02, 0.032, 0.11, 1.0);
      this.vertextBufferData.push(x, y, z, 0.02, 0.032, 0.11, 1.0);
    }

    // vboの生成
    this.vbo = [        // WebGLBuffer を 配列に格納しておきます
    this.createVbo(this.vertextBufferData),
      // this.createVbo(this.p),
      // this.createVbo(this.c),
    ];
  }

  // VBO生成メソッド 
  createVbo(data){
    if(this.gl == null){
      throw new Error('webgl not initialized');
    }
    const gl = this.gl;            // webgl API
    const vbo = gl.createBuffer(); // 空のバッファオブジェクトを生成する
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo); // バッファを gl.ARRAY_BUFFER としてバインドする
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW); // バインドしたバッファに Float32Array オブジェクトに変換した配列を設定する
    gl.bindBuffer(gl.ARRAY_BUFFER, null);// 安全のために最後にバインドを解除します
    return vbo; // バッファオブジェクトを返す
  }

  render(){
    const gl = this.gl;                                                        // webgl API
    if(this.running === true) requestAnimationFrame(this.render);
    this.nowTime = (Date.now() - this.beginTime) / 1000;                       // 経過時間を取得
    this.canvas.width = window.innerWidth;                                     // canvas の幅を ウィンドウのサイズに合わせる
    this.canvas.height = window.innerHeight;                                   // canvas の高さを ウィンドウのサイズに合わせる
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);                  // WebGL上のビューポートも canvas のサイズに合わせる
    gl.clear(gl.COLOR_BUFFER_BIT);                                             // 予め設定しておいた色で canvas をクリアする
    gl.useProgram(this.program);                                               // 使用するプログラムオブジェクトを明示的に指定する
    // VBO と attribute location と ストライドを使用して頂点を有効にする
    this.setAttribute(
      this.vbo,
      this.attLocation,
      this.attStride
    );
    this.createModelMatrix(gl);
  }

  // attribute 変数にデータを転送する
  setAttribute(vbo, attL, attS, ibo = null){
    if(this.gl == null){
      throw new Error('webgl not initialized');
    }
    const gl = this.gl;                                                        // webgl API
    const byteLength = this.attSAmount * 4;                                    // @@@ インターリーブ
    vbo.forEach((v, index) => {                                                // 
      gl.bindBuffer(gl.ARRAY_BUFFER, v);                                       // バッファに頂点の位置属性をバインド
      gl.enableVertexAttribArray(attL[index]);                                 // 送り先の attribute 変数のロケーションを有効化します
      gl.vertexAttribPointer(attL[index], attS[index], gl.FLOAT, false, byteLength, 0); // 対象のロケーションに対して、このストライドで浮動小数点として今バインドしているvboを使用する
      gl.enableVertexAttribArray(attL[index + 1]);                                 // 送り先の attribute 変数のロケーションを有効化します
      gl.vertexAttribPointer(attL[index + 1], attS[index + 1], gl.FLOAT, false, byteLength, 12); // 対象のロケーションに対して、このストライドで浮動小数点として今バインドしているvboを使用する
    });

    if(ibo != null) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  }

  setUniform(value, uniL, uniT){ // [Array(4)] [WebGLUniformLocation], ['uniform4fv']
    if(this.gl == null){
      throw new Error('webgl not initialized');
    }
    const gl = this.gl;
    value.forEach((v, index) => { // [0.1, 1, 0.5, 1], 0
      const type = uniT[index]; // uniform4fv
      if(type.includes('Matrix') === true){ // 特定の要素が配列に含まれているかどうかを true または false で返しま
        
        gl[type](uniL[index], false, v);
      } else {
        //  uniform4fv(WebGLUniformLocation, [0.1, 1, 0.5, 1]);
        gl[type](uniL[index], v);
      }
    });  
  }

  // modelMatrixの生成
  createModelMatrix(gl){
    const m4 = WebGLMath.Mat4;
    const v3 = WebGLMath.Vec3;

    // 1つ目のモデル座標変行列
    const t  = m4.identity(); // 単位行列の生成
    this.modelMatrix = t;
    this.setUniform(
      [
        [0.1, 1.0, 0.5, 1.0],                    // 色
        [window.innerWidth, window.innerHeight], // 解像度
        [this.mouse.x, -this.mouse.y],
        [this.mouse.clientX],
        this.modelMatrix,
        [0.0],
      ],
      this.uniLocation,
      this.uniType
    );
    // 1回目(1つ目のモデル)のドローコール!
    gl.drawArrays(gl.POINTS, 0, this.p.length / 3); // 転送済みの情報を使用して、頂点を画面にレンダリングする

    // 2つ目のモデル座標変行列
    m4.identity(this.modelMatrix); // modelMatrixを初期化
    const tMatrix = m4.translate(t, [-1.0, 0.0, 0.0], t); // 2つ目のモデルは 原点から X軸 -1.0 の位置に移動させます
    this.modelMatrix = m4.scale(tMatrix, [.1, .1, 1.0], tMatrix); // 4つ目のモデルは 0.1倍の大きさに縮小させます
    this.setUniform(
      [
        [0.1, 1.0, 0.5, 1.0],
        [window.innerWidth, window.innerHeight],
        [this.mouse.x, -this.mouse.y],
        [this.mouse.clientX],
        this.modelMatrix,
        [1.0],
      ],
      this.uniLocation,
      this.uniType
    );
    // 2回目(2つ目のモデル)のドローコール!
    gl.drawArrays(gl.POINTS, 0, this.p.length / 3);

    // 3つ目のモデル座標変換行列
    m4.identity(this.modelMatrix); // modelMatrixを初期化
    this.modelMatrix = m4.scale(t, [.55, .55, 1.0], t); // 3つ目のモデルは 5倍の大きさに拡大させます
    this.setUniform(
      [
        [0.1, 1.0, 0.5, 1.0],
        [window.innerWidth, window.innerHeight],
        [this.mouse.x, -this.mouse.y],
        [this.mouse.clientX],
        this.modelMatrix,
        [1.0],
      ],
      this.uniLocation,
      this.uniType
    );
    // 3回目(3つ目のモデル)のドローコール!
    gl.drawArrays(gl.POINTS, 0, this.p.length / 3);

    // 4つ目のモデル座標変換行列
    m4.identity(this.modelMatrix); // modelMatrixを初期化
    this.modelMatrix = m4.translate(t, [1.0, 0.0, 0.0], t); // 4つ目のモデルは 原点から X軸 1.0 の位置に移動させます
    this.setUniform(
      [
        [0.1, 1.0, 0.5, 1.0],
        [window.innerWidth, window.innerHeight],
        [this.mouse.x, -this.mouse.y],
        [this.mouse.clientX],
        this.modelMatrix,
        [1.0],
      ],
      this.uniLocation,
      this.uniType
    );
    // 4回目(4つ目のモデル)のドローコール!
    gl.drawArrays(gl.POINTS, 0, this.p.length / 3);
  }
}