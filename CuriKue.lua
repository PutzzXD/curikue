-- ╔══════════════════════════════════════════════╗
-- ║         PUTZZDEV | CURI KUE SCRIPT           ║
-- ║     ESP Cookie + NoClip + Auto Collect       ║
-- ║        + Chams Nenek (Fixed)                ║
-- ╚══════════════════════════════════════════════╝

local Players     = game:GetService("Players")
local RunService  = game:GetService("RunService")
local Camera      = workspace.CurrentCamera
local LocalPlayer = Players.LocalPlayer
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")

-- ================== STATE ==================
local espCookieEnabled   = false
local noclipEnabled      = false
local noclipConn         = nil
local chamsEnabled       = false
local autoCollectEnabled = false

local chamsColor        = Color3.fromRGB(255, 0, 0) -- Merah buat Nenek (warning)
local chamsTransparency = 0.3
local chamsParts        = {}  -- {nenekObject = highlightInstance}
local chamsConnections  = {}

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
    return n:find("cookie") or n:find("kue") or n:find("biscuit") or n:find("biskuit")
end

local function isNenek(obj)
    local n = obj.Name:lower()
    return n:find("nenek") or n:find("grandma") or n:find("grandmother")
end

local function initCookieESP()
    -- Hapus data lama
    for _, d in pairs(cookieData) do
        pcall(function() d.label:Remove() end)
        pcall(function() if d.hl then d.hl:Destroy() end end)
    end
    cookieData = {}

    for _, obj in pairs(workspace:GetDescendants()) do
        if (obj:IsA("Model") or obj:IsA("BasePart")) and isCookiePart(obj) then
            -- Skip kalo bagian dari karakter player
            if LocalPlayer.Character and obj:IsDescendantOf(LocalPlayer.Character) then continue end
            
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

-- Init awal
initCookieESP()

-- Re-scan tiap 5 detik
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

-- ================== AUTO COLLECT COOKIE (FIXED) ==================
local function getNearestCookie()
    if not LocalPlayer.Character then return nil end
    local hrp = LocalPlayer.Character:FindFirstChild("HumanoidRootPart")
    if not hrp then return nil end

    local nearest = nil
    local nearestDist = math.huge

    for _, d in pairs(cookieData) do
        local obj = d.obj
        if obj and obj.Parent then
            local targetPart = obj:IsA("Model") and (obj.PrimaryPart or obj:FindFirstChildWhichIsA("BasePart")) or obj
            if targetPart and targetPart.Transparency < 1 then
                local dist = (hrp.Position - targetPart.Position).Magnitude
                if dist < nearestDist then
                    nearestDist = dist
                    nearest = targetPart
                end
            end
        end
    end
    return nearest, nearestDist
end

task.spawn(function()
    while true do
        task.wait(0.15) -- loop cepat biar responsif
        if autoCollectEnabled and LocalPlayer.Character then
            local hrp = LocalPlayer.Character:FindFirstChild("HumanoidRootPart")
            if not hrp then continue end

            local target, dist = getNearestCookie()
            if target and dist < 50 then -- dalam jangkauan 50 studs
                -- Gerakan mulus ke target menggunakan Tween
                local targetPos = target.Position + Vector3.new(0, 3, 0) -- di atas cookie
                local tweenInfo = TweenInfo.new(0.2, Enum.EasingStyle.Linear)
                local tween = TweenService:Create(hrp, tweenInfo, {CFrame = CFrame.new(targetPos)})
                tween:Play()
                tween.Completed:Wait()

                -- Coba ambil cookie dengan ProximityPrompt
                local prompt = target.Parent:FindFirstChildOfClass("ProximityPrompt") or target:FindFirstChildOfClass("ProximityPrompt")
                if prompt then
                    fireproximityprompt(prompt)
                    task.wait(0.2)
                else
                    -- Alternatif: simulasi klik atau touch (jika game menggunakan ClickDetector)
                    local click = target.Parent:FindFirstChildOfClass("ClickDetector") or target:FindFirstChildOfClass("ClickDetector")
                    if click then
                        click:Click()
                        task.wait(0.2)
                    end
                end

                -- Tunggu sebentar biar cookie ke-ambil
                task.wait(0.3)
            end
        end
    end
end)

-- ================== CHAMS UNTUK NENEK (FIXED) ==================
local function applyChamsToNenek(nenekModel)
    if not nenekModel or not nenekModel.Parent then return end
    -- Hapus highlight sebelumnya jika ada
    local old = chamsParts[nenekModel]
    if old then
        pcall(function() old:Destroy() end)
        chamsParts[nenekModel] = nil
    end

    local hl = Instance.new("Highlight")
    hl.Name                = "NenekChams"
    hl.FillColor           = chamsColor
    hl.FillTransparency    = chamsTransparency
    hl.OutlineColor        = Color3.fromRGB(255, 255, 255)
    hl.OutlineTransparency = 0
    hl.DepthMode           = Enum.HighlightDepthMode.AlwaysOnTop
    hl.Adornee             = nenekModel
    hl.Parent              = nenekModel

    chamsParts[nenekModel] = hl
end

local function removeChamsFromNenek(nenekModel)
    if not nenekModel then return end
    local hl = chamsParts[nenekModel]
    if hl then
        pcall(function() hl:Destroy() end)
        chamsParts[nenekModel] = nil
    end
    -- Cari highlight liar
    local stray = nenekModel:FindFirstChild("NenekChams")
    if stray then pcall(function() stray:Destroy() end) end
end

local function scanNenek()
    if not chamsEnabled then return end
    for _, obj in pairs(workspace:GetDescendants()) do
        if obj:IsA("Model") and isNenek(obj) then
            applyChamsToNenek(obj)
        end
    end
end

local function toggleChams(state)
    chamsEnabled = state
    if state then
        scanNenek()
        -- Listen for new Nenek
        local conn = workspace.DescendantAdded:Connect(function(obj)
            if chamsEnabled and obj:IsA("Model") and isNenek(obj) then
                applyChamsToNenek(obj)
            end
        end)
        table.insert(chamsConnections, conn)
        -- Cleanup saat Nenek dihapus
        local conn2 = workspace.DescendantRemoving:Connect(function(obj)
            if obj:IsA("Model") and isNenek(obj) then
                removeChamsFromNenek(obj)
            end
        end)
        table.insert(chamsConnections, conn2)
    else
        -- Hapus semua chams Nenek
        for nenek, hl in pairs(chamsParts) do
            pcall(function() hl:Destroy() end)
        end
        chamsParts = {}
        for _, conn in pairs(chamsConnections) do
            pcall(function() conn:Disconnect() end)
        end
        chamsConnections = {}
        -- Hapus highlight yang tertinggal
        for _, obj in pairs(workspace:GetDescendants()) do
            if obj:IsA("Model") and isNenek(obj) then
                local stray = obj:FindFirstChild("NenekChams")
                if stray then pcall(function() stray:Destroy() end) end
            end
        end
    end
end

-- Re-scan Nenek tiap 3 detik
task.spawn(function()
    while true do
        task.wait(3)
        if chamsEnabled then scanNenek() end
    end
end)

-- ================== RENDER LOOP ESP COOKIE ==================
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
    ConfigurationSaving = { Enabled = false },
    Discord = { Enabled = false },
    KeySystem = false,
})

local TabMain = Window:CreateTab("Main", "cookie")

TabMain:CreateToggle({
    Name = "Auto Collect Cookie 🍪",
    CurrentValue = false,
    Flag = "AutoCollect",
    Callback = function(state)
        autoCollectEnabled = state
        if state then initCookieESP() end
    end,
})

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
    Name = "NoClip (Tembus Tembok)",
    CurrentValue = false,
    Flag = "NoClip",
    Callback = function(state)
        noclipEnabled = state
        if state then startNoclip() else stopNoclip() end
    end,
})

TabMain:CreateToggle({
    Name = "Chams Nenek (Merah)",
    CurrentValue = false,
    Flag = "ChamsNenek",
    Callback = function(state)
        toggleChams(state)
        Rayfield:Notify({
            Title = "Chams Nenek",
            Content = state and "Chams Nenek AKTIF" or "Chams Nenek NONAKTIF",
            Duration = 2,
            Image = 4483362458,
        })
    end,
})

LocalPlayer.CharacterAdded:Connect(function()
    task.wait(1)
    if noclipEnabled then startNoclip() end
end)

print("[Putzzdev] Curi Kue Script loaded! 🍪")