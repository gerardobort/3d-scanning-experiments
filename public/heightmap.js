
if ( ! Detector.webgl ) {

    Detector.addGetWebGLMessage();
    document.getElementById( 'container' ).innerHTML = "";

}

var container;

var camera, controls, scene, renderer;

var mesh, texture;

var worldWidth = canvasDepth.width, worldDepth = canvasDepth.height,
worldHalfWidth = worldWidth / 2, worldHalfDepth = worldDepth / 2;

var clock = new THREE.Clock();

//init();
//animate();

function init() {

    container = document.getElementById( 'container' );

    camera = new THREE.PerspectiveCamera( 60, 1/*window.innerWidth / window.innerHeight*/, 1, 2000 );
    camera.position.x = 0;
    camera.position.y = 100;
    camera.position.z = 50;
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    scene = new THREE.Scene();


    var geometry = new THREE.PlaneGeometry( worldWidth, worldDepth, worldWidth - 1, worldDepth - 1 );
    geometry.applyMatrix( new THREE.Matrix4().makeRotationX( - Math.PI / 2 ) );
    geometry.dynamic = true;

    texture = new THREE.Texture( generateTexture( worldWidth, worldDepth ), new THREE.UVMapping(), THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping );
    texture.needsUpdate = true;

    mesh = new THREE.Mesh( geometry, new THREE.MeshBasicMaterial( { map: texture } ) );
    mesh.name = 'heightmap';
    scene.add( mesh );

    renderer = new THREE.WebGLRenderer();
    renderer.setClearColor( 0x000000 );
    renderer.setSize( 600, 600 );

    container.innerHTML = "";
    container.appendChild( renderer.domElement );


    controls = new THREE.TrackballControls( camera, renderer.domElement );
    controls.rotateSpeed = 1.0;
    controls.zoomSpeed = 1.2;
    controls.panSpeed = 0.8;

    window.addEventListener( 'resize', onWindowResize, false );
}

function updateHeightmap() {
    var mesh = scene.getObjectByName('heightmap'),
        geometry = mesh.geometry,
        texture = mesh.material.map;

    data = generateHeight( worldWidth, worldDepth );
    for ( var i = 0, l = geometry.vertices.length; i < l; i ++ ) {
        mesh.geometry.vertices[ i ].y = data[ i ];
    }
    geometry.verticesNeedUpdate = true;

    texture.image.getContext('2d').drawImage( canvas, 0, 0 );
    texture.needsUpdate = true;
}

function onWindowResize() {
    camera.aspect = 1;//window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    //renderer.setSize( window.innerWidth, window.innerHeight );

    controls.handleResize();

}

function generateHeight( width, height ) {

    var size = width * height, data = new Float32Array( size ), d;
    
    mapData = canvasFrame.depthContext.getImageData(0, 0, canvasDepth.width, canvasDepth.height).data;
    for ( var i = 0; i < size; i++ ) {
        d = mapData[i*4]*demo.DEPTH_SCALE;
        data[ i ] = d;
    }

    return data;

}

function generateTexture( width, height ) {

    var canvasScaled, context;

    // Scaled 4x
    canvasScaled = document.createElement( 'canvas' );
    canvasScaled.width = width * 4;
    canvasScaled.height = height * 4;

    context = canvasScaled.getContext( '2d' );
    context.scale( 4, 4 );
    context.drawImage( canvas, 0, 0 );

    return canvasScaled;

}

//

function animate() {

    requestAnimationFrame( animate );

    render();

}

function render() {

    controls.update( clock.getDelta() );
    renderer.render( scene, camera );

}
