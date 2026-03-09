[CmdletBinding()]
param(
    [string]$StoreName = "MiniMarket POS",
    [string]$StoreRut = "",
    [string]$StoreAddress = "",
    [ValidatePattern("^\d{4,10}$")]
    [string]$AdminPin = "1234",
    [ValidatePattern("^\d{4,10}$")]
    [string]$CashierPin = "0000",
    [int]$RegisterCount = 3,
    [string]$DatabaseName = "minimarket_pos",
    [string]$DatabaseUser = "minimarket_pos",
    [string]$DatabasePassword = "",
    [string]$PostgresSuperPassword = "",
    [int]$ServerPort = 8000,
    [switch]$WithDemoData,
    [switch]$SkipFirewall,
    [switch]$SkipAutoStart,
    [string]$PythonWingetId = "Python.Python.3.12",
    [string]$PostgresWingetId = "PostgreSQL.PostgreSQL.16"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Test-IsAdmin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Ensure-Elevation {
    if (Test-IsAdmin) {
        return
    }

    Write-Host "Re-launching installer with administrator privileges..." -ForegroundColor Yellow
    $scriptPath = $MyInvocation.MyCommand.Path
    $argumentList = @("-ExecutionPolicy", "Bypass", "-File", "`"$scriptPath`"")
    foreach ($entry in $PSBoundParameters.GetEnumerator()) {
        $name = "-$($entry.Key)"
        if ($entry.Value -is [switch]) {
            if ($entry.Value.IsPresent) {
                $argumentList += $name
            }
            continue
        }

        $argumentList += $name
        $argumentList += "`"$($entry.Value)`""
    }

    Start-Process -FilePath "powershell.exe" -Verb RunAs -ArgumentList $argumentList | Out-Null
    exit 0
}

function New-SafeSecret {
    param([int]$Length = 24)

    $alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    $builder = New-Object System.Text.StringBuilder
    1..$Length | ForEach-Object {
        [void]$builder.Append($alphabet[(Get-Random -Minimum 0 -Maximum $alphabet.Length)])
    }
    return $builder.ToString()
}

function Get-RepoRoot {
    return (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent)
}

function Get-ServerDir {
    $repoRoot = Get-RepoRoot
    return Join-Path $repoRoot "server-fastapi"
}

function Find-CommandPath {
    param([string]$CommandName)
    $cmd = Get-Command $CommandName -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }
    return $null
}

function Get-PythonExe {
    $candidates = @(
        (Find-CommandPath "py"),
        (Find-CommandPath "python")
    ) | Where-Object { $_ }

    foreach ($candidate in $candidates) {
        if ($candidate -like "*\py.exe") {
            return @($candidate, "-3")
        }
        return @($candidate)
    }

    return $null
}

function Get-PythonVersion {
    param([string[]]$PythonCommand)

    $exe = $PythonCommand[0]
    $prefix = @()
    if ($PythonCommand.Length -gt 1) {
        $prefix = $PythonCommand[1..($PythonCommand.Length - 1)]
    }

    $output = & $exe @prefix -c "import sys; print(f'{sys.version_info[0]}.{sys.version_info[1]}')"
    if ($LASTEXITCODE -ne 0) {
        return $null
    }

    return [version]"$output.0"
}

function Invoke-Python {
    param(
        [string[]]$PythonCommand,
        [string[]]$Arguments
    )

    if (-not $PythonCommand) {
        throw "Python command not resolved."
    }

    $exe = $PythonCommand[0]
    $prefix = @()
    if ($PythonCommand.Length -gt 1) {
        $prefix = $PythonCommand[1..($PythonCommand.Length - 1)]
    }

    & $exe @prefix @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Python command failed: $exe $($Arguments -join ' ')"
    }
}

function Ensure-Winget {
    if (-not (Find-CommandPath "winget")) {
        throw "winget is required for first-run installation of Python/PostgreSQL."
    }
}

function Ensure-Python {
    $pythonCommand = Get-PythonExe
    if ($pythonCommand) {
        $version = Get-PythonVersion -PythonCommand $pythonCommand
        if ($version -and $version -ge [version]"3.11.0") {
            return $pythonCommand
        }
    }

    Ensure-Winget
    Write-Step "Installing Python via winget"
    winget install --id $PythonWingetId --exact --silent --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) {
        throw "Python installation failed."
    }

    $pythonCommand = Get-PythonExe
    if (-not $pythonCommand) {
        throw "Python was installed but could not be located."
    }

    return $pythonCommand
}

function Find-PostgresBinDir {
    $psqlPath = Find-CommandPath "psql"
    if ($psqlPath) {
        return Split-Path $psqlPath -Parent
    }

    $root = "C:\Program Files\PostgreSQL"
    if (-not (Test-Path $root)) {
        return $null
    }

    $versions = Get-ChildItem $root -Directory | Sort-Object Name -Descending
    foreach ($versionDir in $versions) {
        $candidate = Join-Path $versionDir.FullName "bin"
        if (Test-Path (Join-Path $candidate "psql.exe")) {
            return $candidate
        }
    }

    return $null
}

function Ensure-Postgres {
    $binDir = Find-PostgresBinDir
    if ($binDir) {
        if (-not $script:PostgresSuperPassword) {
            throw "PostgreSQL already exists. Re-run the installer with -PostgresSuperPassword so the script can create the application database."
        }
        return $binDir
    }

    Ensure-Winget
    Write-Step "Installing PostgreSQL via winget"

    if (-not $script:PostgresSuperPassword) {
        $script:PostgresSuperPassword = New-SafeSecret
    }

    $majorVersion = ($PostgresWingetId -split "\.")[-1]
    $serviceName = "postgresql-x64-$majorVersion"
    $override = "--mode unattended --unattendedmodeui minimal --superpassword `"$script:PostgresSuperPassword`" --servicename `"$serviceName`" --serverport 5432"

    winget install --id $PostgresWingetId --exact --silent --accept-package-agreements --accept-source-agreements --override $override
    if ($LASTEXITCODE -ne 0) {
        throw "PostgreSQL installation failed."
    }

    Start-Sleep -Seconds 8
    $binDir = Find-PostgresBinDir
    if (-not $binDir) {
        throw "PostgreSQL was installed but psql.exe could not be located."
    }

    return $binDir
}

function Wait-ForPostgres {
    param(
        [string]$PsqlExe,
        [int]$Attempts = 30
    )

    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        try {
            & $PsqlExe -h localhost -U postgres -d postgres -c "SELECT 1;" | Out-Null
            if ($LASTEXITCODE -eq 0) {
                return
            }
        } catch {
        }

        Start-Sleep -Seconds 2
    }

    throw "PostgreSQL did not become ready in time."
}

function Invoke-PsqlScript {
    param(
        [string]$PsqlExe,
        [string]$Sql
    )

    $tempFile = [System.IO.Path]::GetTempFileName()
    try {
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($tempFile, $Sql, $utf8NoBom)
        & $PsqlExe -h localhost -U postgres -d postgres -v ON_ERROR_STOP=1 -f $tempFile
        if ($LASTEXITCODE -ne 0) {
            throw "psql execution failed."
        }
    } finally {
        Remove-Item $tempFile -ErrorAction SilentlyContinue
    }
}

function ConvertTo-SqlLiteral {
    param([string]$Value)
    return $Value.Replace("'", "''")
}

function Assert-SqlIdentifier {
    param([string]$Value, [string]$Label)

    if ($Value -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
        throw "$Label must use only letters, numbers and underscores, and cannot start with a number."
    }
}

function Ensure-Database {
    param(
        [string]$PsqlExe,
        [string]$AppDbName,
        [string]$AppDbUser,
        [string]$AppDbPassword
    )

    Assert-SqlIdentifier -Value $AppDbName -Label "DatabaseName"
    Assert-SqlIdentifier -Value $AppDbUser -Label "DatabaseUser"

    $userLiteral = ConvertTo-SqlLiteral -Value $AppDbUser
    $passwordLiteral = ConvertTo-SqlLiteral -Value $AppDbPassword
    $dbLiteral = ConvertTo-SqlLiteral -Value $AppDbName

    $sql = @'
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '__APP_DB_USER_LITERAL__') THEN
        CREATE ROLE __APP_DB_USER_IDENTIFIER__ LOGIN PASSWORD '__APP_DB_PASSWORD_LITERAL__';
    ELSE
        ALTER ROLE __APP_DB_USER_IDENTIFIER__ WITH LOGIN PASSWORD '__APP_DB_PASSWORD_LITERAL__';
    END IF;
END
$$;

SELECT 'CREATE DATABASE __APP_DB_NAME_IDENTIFIER__ OWNER __APP_DB_USER_IDENTIFIER__'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '__APP_DB_NAME_LITERAL__')\gexec

GRANT ALL PRIVILEGES ON DATABASE __APP_DB_NAME_IDENTIFIER__ TO __APP_DB_USER_IDENTIFIER__;
'@
    $sql = $sql.Replace("__APP_DB_USER_LITERAL__", $userLiteral)
    $sql = $sql.Replace("__APP_DB_PASSWORD_LITERAL__", $passwordLiteral)
    $sql = $sql.Replace("__APP_DB_NAME_LITERAL__", $dbLiteral)
    $sql = $sql.Replace("__APP_DB_USER_IDENTIFIER__", $AppDbUser)
    $sql = $sql.Replace("__APP_DB_NAME_IDENTIFIER__", $AppDbName)

    Invoke-PsqlScript -PsqlExe $PsqlExe -Sql $sql
}

function Ensure-DatabaseOwnership {
    param(
        [string]$PsqlExe,
        [string]$AppDbName,
        [string]$AppDbUser
    )

    Assert-SqlIdentifier -Value $AppDbName -Label "DatabaseName"
    Assert-SqlIdentifier -Value $AppDbUser -Label "DatabaseUser"

    $sql = @'
ALTER DATABASE __APP_DB_NAME_IDENTIFIER__ OWNER TO __APP_DB_USER_IDENTIFIER__;
ALTER SCHEMA public OWNER TO __APP_DB_USER_IDENTIFIER__;

GRANT ALL PRIVILEGES ON DATABASE __APP_DB_NAME_IDENTIFIER__ TO __APP_DB_USER_IDENTIFIER__;
GRANT ALL PRIVILEGES ON SCHEMA public TO __APP_DB_USER_IDENTIFIER__;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO __APP_DB_USER_IDENTIFIER__;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO __APP_DB_USER_IDENTIFIER__;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO __APP_DB_USER_IDENTIFIER__;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO __APP_DB_USER_IDENTIFIER__;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO __APP_DB_USER_IDENTIFIER__;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON FUNCTIONS TO __APP_DB_USER_IDENTIFIER__;

DO $$
DECLARE
    obj record;
BEGIN
    FOR obj IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I OWNER TO __APP_DB_USER_IDENTIFIER__', obj.tablename);
    END LOOP;

    FOR obj IN
        SELECT sequence_name
        FROM information_schema.sequences
        WHERE sequence_schema = 'public'
    LOOP
        EXECUTE format('ALTER SEQUENCE public.%I OWNER TO __APP_DB_USER_IDENTIFIER__', obj.sequence_name);
    END LOOP;

    FOR obj IN
        SELECT table_name
        FROM information_schema.views
        WHERE table_schema = 'public'
    LOOP
        EXECUTE format('ALTER VIEW public.%I OWNER TO __APP_DB_USER_IDENTIFIER__', obj.table_name);
    END LOOP;
END
$$;
'@
    $sql = $sql.Replace("__APP_DB_USER_IDENTIFIER__", $AppDbUser)
    $sql = $sql.Replace("__APP_DB_NAME_IDENTIFIER__", $AppDbName)

    Invoke-PsqlScript -PsqlExe $PsqlExe -Sql $sql
}

function Ensure-Venv {
    param(
        [string[]]$PythonCommand,
        [string]$ServerDir
    )

    $venvPython = Join-Path $ServerDir "venv\Scripts\python.exe"
    if (-not (Test-Path $venvPython)) {
        Write-Step "Creating Python virtual environment"
        Invoke-Python -PythonCommand $PythonCommand -Arguments @("-m", "venv", (Join-Path $ServerDir "venv"))
    }

    Write-Step "Installing backend dependencies"
    & $venvPython -m pip install --upgrade pip | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "pip upgrade failed."
    }

    & $venvPython -m pip install -r (Join-Path $ServerDir "requirements.txt") | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "Dependency installation failed."
    }

    return $venvPython
}

function Invoke-Bootstrap {
    param(
        [string]$PythonExe,
        [string]$ServerDir,
        [string]$DatabaseUrl
    )

    Write-Step "Writing .env and initializing schema"
    $args = @(
        (Join-Path $ServerDir "bootstrap.py"),
        "--database-url", $DatabaseUrl,
        "--server-port", "$ServerPort",
        "--store-name", $StoreName,
        "--admin-pin", $AdminPin,
        "--cashier-pin", $CashierPin,
        "--register-count", "$RegisterCount",
        "--overwrite-env"
    )

    if ($StoreRut) {
        $args += @("--store-rut", $StoreRut)
    }

    if ($StoreAddress) {
        $args += @("--store-address", $StoreAddress)
    }

    if ($WithDemoData.IsPresent) {
        $args += "--with-demo-data"
    }

    & $PythonExe @args
    if ($LASTEXITCODE -ne 0) {
        throw "bootstrap.py failed."
    }
}

function Ensure-FirewallRule {
    param([int]$Port)

    if ($SkipFirewall.IsPresent) {
        return
    }

    $ruleName = "MiniMarket POS API"
    $existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    if (-not $existing) {
        Write-Step "Opening Windows Firewall port $Port"
        New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port | Out-Null
    }
}

function Ensure-AutostartTask {
    param(
        [string]$PythonExe,
        [string]$ServerDir
    )

    if ($SkipAutoStart.IsPresent) {
        return
    }

    Write-Step "Registering startup task"
    $taskName = "MiniMarketPOS-Server"
    $serveScript = Join-Path $ServerDir "serve.py"
    $taskCommand = "`"$PythonExe`" `"$serveScript`""

    schtasks /Create /F /SC ONSTART /RL HIGHEST /RU SYSTEM /TN $taskName /TR $taskCommand | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Could not create startup task."
    }

    schtasks /Run /TN $taskName | Out-Null
}

Ensure-Elevation

if (-not $DatabasePassword) {
    $DatabasePassword = New-SafeSecret
}

$repoRoot = Get-RepoRoot
$serverDir = Get-ServerDir

if (-not (Test-Path (Join-Path $serverDir "bootstrap.py"))) {
    throw "server-fastapi bootstrap.py not found. Run this script from the project repository."
}

Write-Step "Resolving Python"
$pythonCommand = Ensure-Python

Write-Step "Resolving PostgreSQL"
$postgresBinDir = Ensure-Postgres
$psqlExe = Join-Path $postgresBinDir "psql.exe"

$env:PGPASSWORD = $PostgresSuperPassword
Wait-ForPostgres -PsqlExe $psqlExe

Write-Step "Creating application database and role"
Ensure-Database -PsqlExe $psqlExe -AppDbName $DatabaseName -AppDbUser $DatabaseUser -AppDbPassword $DatabasePassword

Write-Step "Normalizing database ownership and privileges"
& $psqlExe -h localhost -U postgres -d $DatabaseName -c "SELECT 1;" | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Could not connect to application database as postgres."
}
Ensure-DatabaseOwnership -PsqlExe $psqlExe -AppDbName $DatabaseName -AppDbUser $DatabaseUser

$databaseUrl = "postgresql://${DatabaseUser}:${DatabasePassword}@localhost:5432/$DatabaseName"
$venvPython = Ensure-Venv -PythonCommand $pythonCommand -ServerDir $serverDir
Invoke-Bootstrap -PythonExe $venvPython -ServerDir $serverDir -DatabaseUrl $databaseUrl
Ensure-FirewallRule -Port $ServerPort
Ensure-AutostartTask -PythonExe $venvPython -ServerDir $serverDir

Write-Host ""
Write-Host "MiniMarket POS server installation completed." -ForegroundColor Green
Write-Host "API URL: http://localhost:$ServerPort"
Write-Host "Admin PIN: $AdminPin"
Write-Host "Cashier PIN: $CashierPin"
Write-Host "Database user: $DatabaseUser"
Write-Host "Database password: $DatabasePassword"
Write-Host "PostgreSQL superuser password: $PostgresSuperPassword"
