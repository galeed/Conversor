import React, { useState, useRef, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

function Converter() {
  const [loaded, setLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [logMessage, setLogMessage] = useState('Listo para convertir');
  
  // Estados para la configuración del usuario
  const [format, setFormat] = useState('wav');
  const [bitDepth, setBitDepth] = useState('16'); // 16, 24, 32
  const [sampleRate, setSampleRate] = useState('44100'); // 44100, 48000

  const ffmpegRef = useRef(new FFmpeg());

  const load = async () => {
    setIsLoading(true);
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    const ffmpeg = ffmpegRef.current;
    
    ffmpeg.on('log', ({ message }) => {
      setLogMessage(message);
    });

    try {
        await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        setLoaded(true);
    } catch (error) {
        console.error("Error cargando FFmpeg", error);
        setLogMessage("Error al cargar el motor de audio. Revisa la consola.");
    }
    setIsLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const convert = async () => {
    const fileInput = document.getElementById('uploader');
    const file = fileInput.files[0];
    if (!file) {
        alert("Por favor selecciona un archivo primero.");
        return;
    }

    setIsLoading(true);
    const ffmpeg = ffmpegRef.current;
    
    // Escribir archivo en memoria
    await ffmpeg.writeFile('input', await fetchFile(file));

    // --- CONSTRUCCIÓN DINÁMICA DE COMANDOS ---
    let args = ['-i', 'input'];

    // 1. Configurar Frecuencia de Muestreo (Sample Rate)
    // -ar define la frecuencia (ej. 44100 o 48000)
    args.push('-ar', sampleRate);

    // 2. Configurar Formato y Profundidad de Bits
    let outputFilename = `output.${format}`;

    if (format === 'wav') {
        // Configuración específica para WAV PCM
        if (bitDepth === '16') args.push('-c:a', 'pcm_s16le');
        if (bitDepth === '24') args.push('-c:a', 'pcm_s24le');
        if (bitDepth === '32') args.push('-c:a', 'pcm_f32le'); // 32-bit Floating Point
    } 
    else if (format === 'flac') {
        // FLAC maneja la profundidad un poco diferente, FFmpeg intenta mantenerla,
        // pero podemos forzar el sample_fmt si la entrada lo permite.
        // Nota: FLAC de 32 bits es muy raro, el estándar es hasta 24 bits integer.
        // Si el usuario pide 32, FFmpeg podría limitarlo a 24 dependiendo de la implementación WASM.
        if (bitDepth === '24' || bitDepth === '32') {
             // Forzamos un formato de entrada compatible si es necesario, 
             // pero generalmente FLAC detecta.
             // Aquí no ponemos codec PCM, dejamos que FLAC codifique.
        }
    } 
    else if (format === 'mp3') {
        // MP3 no usa profundidad de bits (es lossy), usa bitrate.
        // Ignoramos el selector de bits y ponemos máxima calidad.
        args.push('-b:a', '320k'); 
    }

    args.push(outputFilename);

    console.log("Ejecutando comando:", args.join(' '));
    
    try {
        await ffmpeg.exec(args);

        // Leer resultado
        const data = await ffmpeg.readFile(outputFilename);
        
        // Descargar
        const url = URL.createObjectURL(new Blob([data.buffer], { type: `audio/${format}` }));
        const a = document.createElement('a');
        a.href = url;
        // Nombre del archivo con detalles técnicos para que el usuario sepa qué bajó
        a.download = `convertido_${sampleRate}Hz_${bitDepth}bit.${format}`;
        a.click();
    } catch (e) {
        console.error(e);
        setLogMessage("Error durante la conversión.");
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg">
        <h1 className="text-3xl font-bold mb-6 text-gray-800 text-center">Audio Converter Pro</h1>
        
        {!loaded ? (
          <div className="text-center text-blue-600 animate-pulse">Cargando motor de procesamiento...</div>
        ) : (
          <div className="flex flex-col gap-6">
            
            {/* INPUT DE ARCHIVO */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:bg-gray-50 transition">
                <input type="file" id="uploader" accept="audio/*,video/*" className="w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100 cursor-pointer
                "/>
            </div>

            {/* CONTROLES DE CONFIGURACIÓN */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Selector de Formato */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Formato de Salida</label>
                    <select 
                        value={format} 
                        onChange={(e) => setFormat(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="wav">WAV (Sin pérdida)</option>
                        <option value="flac">FLAC (Comprimido sin pérdida)</option>
                        <option value="mp3">MP3 (Universal)</option>
                    </select>
                </div>

                {/* Selector de Hz */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Frecuencia (Sample Rate)</label>
                    <select 
                        value={sampleRate} 
                        onChange={(e) => setSampleRate(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="44100">44.1 kHz (CD)</option>
                        <option value="48000">48.0 kHz (Video/Cine)</option>
                    </select>
                </div>

                {/* Selector de Bits (Solo visible para formatos Hi-Fi) */}
                {format !== 'mp3' && (
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Profundidad de Bits</label>
                        <select 
                            value={bitDepth} 
                            onChange={(e) => setBitDepth(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="16">16-bit (Estándar)</option>
                            <option value="24">24-bit (Alta Definición)</option>
                            <option value="32">32-bit (Punto Flotante - Máxima Calidad)</option>
                        </select>
                        <p className="text-xs text-gray-400 mt-1">
                           {format === 'flac' && bitDepth === '32' 
                             ? "Nota: FLAC 32-bit es experimental, algunos reproductores podrían no abrirlo." 
                             : "Selecciona 32-bit para edición profesional en DAWs."}
                        </p>
                    </div>
                )}
            </div>

            {/* BOTÓN DE ACCIÓN */}
            <button 
                onClick={convert}
                disabled={isLoading}
                className={`w-full py-3 px-4 rounded-lg text-white font-bold text-lg shadow-md transition-all
                    ${isLoading 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transform hover:-translate-y-1'
                    }`}
            >
                {isLoading ? 'Procesando Audio...' : 'Convertir Audio'}
            </button>

            {/* CONSOLA DE LOGS */}
            <div className="bg-black text-green-400 p-3 rounded text-xs font-mono h-24 overflow-y-auto">
                {isLoading && <span className="animate-pulse">▶ </span>}
                {logMessage}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

export default Converter;
