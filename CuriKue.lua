-- ╔══════════════════════════════════════════════╗
-- ║         PUTZZDEV | CURI KUE SCRIPT           ║
-- ║       ESP Cookie + NoClip (Rayfield)         ║
-- ╚══════════════════════════════════════════════╝

local Players     = game:GetService("Players")
local RunService  = game:GetService("RunService")
local Camera      = workspace.CurrentCamera
local LocalPlayer = Players.LocalPlayer

-- ================== STATE ==================
local espCookieEnabled = false
local noclipEnabled    = false
local noclipConn        = nil
local chamsEnabled = false
local chamsColor = Color3.fromRGB(0, 255, 0) -- Hijau terang
local chamsTransparency = 0.2 -- Biar tembus pandang
local chamsMaterial = Enum.Material.Neon
local chamsParts = {}
local chamsConnections = {}

local playerCounterEnabled = false
local enemyCountText = nil

-- ================== COOKIE ESP DATA ==================
local cookieData = {}

local function newText(color, size)
    local t = Drawing.new("Text")
    t.Size = size or 14; t.Color = color; t.Center = true
    t.Outline = true; t.OutlineColor = Color3.fromRGB(0,0,0); t.Visible = false
    return t
end

local function isCookiePart(obj)
    local n = obj.Name:lower()
    return n:find("cookie") or n:find("kue") or n:find("biscuit")
end

local function initCookieESP()
    -- Bersihkan dulu
    for _, d in pairs(cookieData) do
        pcall(function() d.label:Remove() end)
        pcall(function() if d.hl then d.hl:Destroy() end end)
    end
    cookieData = {}

    for _, obj in pairs(workspace:GetDescendants()) do
        if (obj:IsA("Model") or obj:IsA("BasePart")) and isCookiePart(obj) then
            local hl = Instance.new("Highlight")
            hl.FillColor = Color3.fromRGB(255, 210, 80)
            hl.FillTransparency = 0.25
            hl.OutlineColor = Color3.fromRGB(255, 255, 150)
            hl.OutlineTransparency = 0
            hl.DepthMode = Enum.HighlightDepthMode.AlwaysOnTop
            hl.Enabled = false
            hl.Parent = obj
            local lbl = newText(Color3.fromRGB(255, 210, 80), 14)
            table.insert(cookieData, {obj = obj, hl = hl, label = lbl})
        end
    end
end

initCookieESP()

-- Re-scan tiap beberapa detik (cookies kadang muncul belakangan / acak posisi)
task.spawn(function()
    while true do
        task.wait(5)
        if espCookieEnabled then initCookieESP() end
    end
end)

-- ================== NOCLIP ==================
local function startNoclip()
    if noclipConn then noclipConn:Disconnect() end
    noclipConn = RunService.Stepped:Connect(function()
        if noclipEnabled and LocalPlayer.Character then
            for _, p in pairs(LocalPlayer.Character:GetDescendants()) do
                if p:IsA("BasePart") then
                    p.CanCollide = false
                end
            end
        end
    end)
end

local function stopNoclip()
    if noclipConn then noclipConn:Disconnect(); noclipConn = nil end
    if LocalPlayer.Character then
        for _, p in pairs(LocalPlayer.Character:GetDescendants()) do
            if p:IsA("BasePart") then
                p.CanCollide = true
            end
        end
    end
end

-- ================== RENDER LOOP ESP ==================
RunService.RenderStepped:Connect(function()
    local myChar = LocalPlayer.Character
    local myHRP  = myChar and myChar:FindFirstChild("HumanoidRootPart")
    local myPos  = myHRP and myHRP.Position

    for _, d in pairs(cookieData) do
        local obj = d.obj
        if obj and obj.Parent and espCookieEnabled and myPos then
            local pp = obj:IsA("Model") and (obj.PrimaryPart or obj:FindFirstChildWhichIsA("BasePart")) or obj
            if pp then
                local sp, vis = Camera:WorldToViewportPoint(pp.Position)
                local dist    = math.floor((myPos - pp.Position).Magnitude)
                if vis then
                    d.label.Position = Vector2.new(sp.X, sp.Y - 14)
                    d.label.Text     = "🍪 COOKIE [" .. dist .. "m]"
                    d.label.Visible  = true
                    d.hl.Enabled     = true
                else
                    d.label.Visible = false
                    d.hl.Enabled    = false
                end
            end
        else
            d.label.Visible = false
            if d.hl then d.hl.Enabled = false end
        end
    end
end)

-- ================== RAYFIELD UI ==================
local Rayfield = loadstring(game:HttpGet('https://sirius.menu/rayfield'))()

local Window = Rayfield:CreateWindow({
    Name           = "Curi Kue | Putzzdev",
    LoadingTitle   = "Curi Kue Script",
    LoadingSubtitle= "by Putzzdev",
    ConfigurationSaving = {
        Enabled = false,
    },
    Discord = {
        Enabled = false,
    },
    KeySystem = false,
})

local TabMain = Window:CreateTab("Main", "cookie")

TabMain:CreateToggle({
    Name = "ESP Cookie",
    CurrentValue = false,
    Flag = "ESPCookie",
    Callback = function(state)
        espCookieEnabled = state
        if state then initCookieESP() end
    end,
})

TabMain:CreateButton({
    Name = "🔄 Refresh ESP Cookie",
    Callback = function()
        initCookieESP()
        Rayfield:Notify({
            Title = "Refresh",
            Content = "ESP Cookie diperbarui!",
            Duration = 2,
            Image = 4483362458,
        })
    end,
})

TabMain:CreateDivider()

TabMain:CreateToggle({
    Name = "NoClip",
    CurrentValue = false,
    Flag = "NoClip",
    Callback = function(state)
        noclipEnabled = state
        if state then startNoclip() else stopNoclip() end
    end,
})

-- ================== HOLOGRAM CHAMS (FIXED - PAKAI HIGHLIGHT ASLI) ==================
local function applyChams(player)
    if player == LocalPlayer then return end

    local char = player.Character
    if not char then return end

    pcall(function()
        -- Hapus highlight lama kalau ada, biar ga dobel
        local old = char:FindFirstChild("ChamsHighlight")
        if old then old:Destroy() end

        local hl = Instance.new("Highlight")
        hl.Name                = "ChamsHighlight"
        hl.FillColor           = chamsColor
        hl.FillTransparency    = chamsTransparency
        hl.OutlineColor        = Color3.fromRGB(255, 255, 255)
        hl.OutlineTransparency = 0
        hl.DepthMode           = Enum.HighlightDepthMode.AlwaysOnTop -- ini yang bikin tembus tembok
        hl.Adornee             = char
        hl.Parent               = char

        chamsParts[player] = hl
    end)
end

local function removeChams(player)
    if not player then return end

    local hl = chamsParts[player]
    if hl then
        pcall(function() hl:Destroy() end)
        chamsParts[player] = nil
    end

    -- Fallback: kalau ada player yang ChamsHighlight-nya nyangkut tanpa tabel
    if player.Character then
        local stray = player.Character:FindFirstChild("ChamsHighlight")
        if stray then pcall(function() stray:Destroy() end) end
    end
end

local function toggleChams(state)
    chamsEnabled = state
    
    if state then
        for _, player in pairs(Players:GetPlayers()) do
            if player ~= LocalPlayer then
                applyChams(player)
            end
        end
        
        -- Monitor player baru
        local conn = Players.PlayerAdded:Connect(function(player)
            player.CharacterAdded:Connect(function(char)
                task.wait(0.5)
                if chamsEnabled and player ~= LocalPlayer then
                    applyChams(player)
                end
            end)
            if chamsEnabled and player ~= LocalPlayer then
                task.wait(0.5)
                applyChams(player)
            end
        end)
        table.insert(chamsConnections, conn)
        
        -- Monitor player leaving
        local conn2 = Players.PlayerRemoving:Connect(function(player)
            removeChams(player)
        end)
        table.insert(chamsConnections, conn2)
        
    else
        for _, player in pairs(Players:GetPlayers()) do
            removeChams(player)
        end
        
        for _, conn in pairs(chamsConnections) do
            pcall(function() conn:Disconnect() end)
        end
        chamsConnections = {}
    end
end
})

LocalPlayer.CharacterAdded:Connect(function()
    task.wait(1)
    if noclipEnabled then startNoclip() end
end)

print("[Putzzdev] Curi Kue Script loaded! 🍪")
