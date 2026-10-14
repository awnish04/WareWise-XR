// Quick WebGL test
console.log('Testing WebGL...');

try {
  const canvas = document.createElement('canvas');
  console.log('Canvas created:', !!canvas);
  
  const gl = canvas.getContext('webgl');
  console.log('WebGL context:', !!gl);
  
  if (gl) {
    console.log('✓ WebGL is available');
    console.log('Vendor:', gl.getParameter(gl.VENDOR));
    console.log('Renderer:', gl.getParameter(gl.RENDERER));
  } else {
    console.log('✗ WebGL context is null');
    
    // Try experimental
    const expGl = canvas.getContext('experimental-webgl');
    console.log('Experimental WebGL:', !!expGl);
  }
} catch (e) {
  console.error('Error:', e.message);
}
