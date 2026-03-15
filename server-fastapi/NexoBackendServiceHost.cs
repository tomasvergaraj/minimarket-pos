using System;
using System.Diagnostics;
using System.IO;
using System.ServiceProcess;
using System.Threading;

namespace NexoServiceHost
{
    public sealed class NexoBackendServiceHost : ServiceBase
    {
        private const string ServiceNameConst = "MiniMarketPOS-Server";
        private readonly string serverDir;
        private readonly string logFile;
        private Process backendProcess;
        private bool stopping;

        public NexoBackendServiceHost()
        {
            ServiceName = ServiceNameConst;
            AutoLog = true;
            CanStop = true;
            CanPauseAndContinue = false;
            serverDir = AppDomain.CurrentDomain.BaseDirectory;
            logFile = Path.Combine(serverDir, "logs", "windows-service-host.log");
        }

        public static void Main()
        {
            if (Environment.UserInteractive)
            {
                var service = new NexoBackendServiceHost();
                service.OnStart(Array.Empty<string>());
                Console.WriteLine("Nexo backend service host running. Press Enter to stop.");
                Console.ReadLine();
                service.OnStop();
                return;
            }

            Run(new NexoBackendServiceHost());
        }

        protected override void OnStart(string[] args)
        {
            stopping = false;
            Directory.CreateDirectory(Path.GetDirectoryName(logFile));
            Log("Service wrapper starting.");
            StartBackendProcess();
            Log("Service wrapper started.");
        }

        protected override void OnStop()
        {
            stopping = true;
            Log("Service wrapper stopping.");
            StopBackendProcess();
            Log("Service wrapper stopped.");
        }

        private void StartBackendProcess()
        {
            string pythonExe = Path.Combine(serverDir, "venv", "Scripts", "python.exe");
            string serveScript = Path.Combine(serverDir, "serve.py");

            if (!File.Exists(pythonExe))
            {
                throw new FileNotFoundException("Python executable not found.", pythonExe);
            }

            if (!File.Exists(serveScript))
            {
                throw new FileNotFoundException("serve.py not found.", serveScript);
            }

            backendProcess = new Process();
            backendProcess.StartInfo = new ProcessStartInfo
            {
                FileName = pythonExe,
                Arguments = "\"" + serveScript + "\"",
                WorkingDirectory = serverDir,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
            };
            backendProcess.EnableRaisingEvents = true;
            backendProcess.OutputDataReceived += (sender, eventArgs) =>
            {
                if (!string.IsNullOrWhiteSpace(eventArgs.Data))
                {
                    Log("[stdout] " + eventArgs.Data);
                }
            };
            backendProcess.ErrorDataReceived += (sender, eventArgs) =>
            {
                if (!string.IsNullOrWhiteSpace(eventArgs.Data))
                {
                    Log("[stderr] " + eventArgs.Data);
                }
            };
            backendProcess.Exited += (sender, eventArgs) =>
            {
                Log("Backend process exited with code " + backendProcess.ExitCode + ".");
                if (!stopping)
                {
                    try
                    {
                        Stop();
                    }
                    catch
                    {
                    }
                }
            };

            if (!backendProcess.Start())
            {
                throw new InvalidOperationException("Backend process could not be started.");
            }

            backendProcess.BeginOutputReadLine();
            backendProcess.BeginErrorReadLine();

            Thread.Sleep(2000);
            if (backendProcess.HasExited)
            {
                throw new InvalidOperationException("Backend process exited during startup with code " + backendProcess.ExitCode + ".");
            }
        }

        private void StopBackendProcess()
        {
            if (backendProcess == null)
            {
                return;
            }

            try
            {
                if (!backendProcess.HasExited)
                {
                    backendProcess.Kill();
                    backendProcess.WaitForExit(15000);
                }
            }
            finally
            {
                backendProcess.Dispose();
                backendProcess = null;
            }
        }

        private void Log(string message)
        {
            string line = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " " + message;

            try
            {
                File.AppendAllText(logFile, line + Environment.NewLine);
            }
            catch
            {
            }

            try
            {
                EventLog.WriteEntry(ServiceNameConst, message);
            }
            catch
            {
            }
        }
    }
}
