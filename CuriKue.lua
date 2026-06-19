-- ================== DRIP CLIENT PREMIUM - CURI KUE EDITION ==================

-- ================== LOAD SERVICES ==================
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local workspace = game:GetService("Workspace")
local LocalPlayer = Players.LocalPlayer
local Camera = workspace.CurrentCamera

-- Rayfield Library
local Rayfield = loadstring(game:HttpGet("https://sirius.menu/rayfield"))()

-- ================== INITIALIZATION ==================
local Window = Rayfield:CreateWindow({
    Name = "Drip Client - Curi Kue 🍪",
    LoadingTitle = "Putzzdev",
    LoadingSubtitle = "Premium Edition",
    Theme = "Amethyst",
    DisableRayfieldPrompts = true,
    DisableBuildWarnings = true,
    ConfigurationSaving = { Enabled = false },
    KeySystem = false,
})

-- ================== VARIABLES ==================
-- Toggles
local _G = {
    AutoCollectEat = false,
    GrandmaESP = false,
    CookieESP = false,
    WalkSpeedEnabled = false,
    JumpPowerEnabled = false,
    NoClipEnabled = false,
    InfiniteStamina = false,
}

-- Values
local customSpeed = 50
local customJump = 50

-- Storage untuk ESP Drawing
local grandmaHighlights = {}
local cookieDrawings = {}

-- ================== UTILITY FUNCTIONS ==================

-- Fungsi mencari Nenek di dalam Game (Berdasarkan nama umum NPC Nenek)
local function getGrandma()
    -- Mencari di Workspace
    for _, obj in pairs(workspace:GetChildren()) do
        if obj:IsA("Model") and (string.find(string.lower(obj.Name), "grandma") or string.find(string.lower(obj.Name), "nenek")) then
            return obj
        end
    end
    -- Mencari jika Nenek masuk sebagai Player/Bot khusus
    for _, p in pairs(Players:GetPlayers()) do
        if string.find(string.lower(p.Name), "grandma") or string.find(string.lower(p.Name), "nenek") then
            return p.Character
        end
    end
    return nil
end

-- Fungsi mencari objek Kue / Cookies di Map
local function findCookies()
    local cookies = {}
    for _, obj in pairs(workspace:GetDescendants()) do
        -- Menyesuaikan nama objek kue (Cookie, Cookies, Cake, dsb)
        if obj:IsA("BasePart") or obj:IsA("MeshPart") or obj:IsA("Model") then
            if string.find(string.lower(obj.Name), "cookie") or string.find(string.lower(obj.Name), "kue") then
                table.insert(cookies, obj)
            end
        elseif obj:IsA("ProximityPrompt") then
            if string.find(string.lower(obj.Parent.Name), "cookie") or string.find(string.lower(obj.Parent.Name), "kue") then
                table.insert(cookies, obj.Parent)
            end
        end
    end
    return cookies
end

-- ================== LOOP LOOPS / AUTOMATION ==================

-- 1. INSTANT AUTO COLLECT + AUTO EAT
task.spawn(function()
    while true do
        task.wait(0.1)
        if _G.AutoCollectEat and LocalPlayer.Character and LocalPlayer.Character:FindFirstChild("HumanoidRootPart") then
            local hrp = LocalPlayer.Character.HumanoidRootPart
            local cookies = findCookies()
            
            for _, cookie in pairs(cookies) do
                if _G.AutoCollectEat == false then break end
                
                -- Deteksi bagian utama part kue
                local targetPart = cookie:IsA("Model") and (cookie:FindFirstChild("Handle") or cookie:FindFirstChildOfClass("BasePart")) or cookie
                
                if targetPart and targetPart:IsA("BasePart") then
                    -- Simpan CFrame asli untuk dikembalikan nanti (mencegah glitch jatuh)
                    local originalCF = hrp.CFrame
                    
                    -- INSTANT TELEPORT (Sangat cepat ke kue lalu balik lagi)
                    pcall(function()
                        -- Teleport ke kue
                        hrp.CFrame = targetPart.CFrame
                        task.wait(0.05)
                        
                        -- Trigger ProximityPrompt jika ada mekanismenya
                        local prompt = cookie:FindFirstChildOfClass("ProximityPrompt") or cookie.Parent:FindFirstChildOfClass("ProximityPrompt")
                        if prompt then
                            fireproximityprompt(prompt)
                        end
                        
                        -- Simulasi Instan "Makan/Eat" (Biasanya menggunakan Tools di Inventory)
                        local backpack = LocalPlayer:FindFirstChild("Backpack")
                        local char = LocalPlayer.Character
                        
                        -- Cari item kue di inventory untuk dipakai/dimakan
                        if backpack then
                            for _, tool in pairs(backpack:GetChildren()) do
                                if string.find(string.lower(tool.Name), "cookie") or string.find(string.lower(tool.Name), "kue") then
                                    tool.Parent = char -- Equip kue
                                    task.wait(0.05)
                                    tool:Activate() -- Makan kue
                                    task.wait(0.05)
                                    tool.Parent = backpack -- Taruh kembali jika belum habis
                                end
                            end
                        end
                        
                        -- Kembalikan posisi player ke posisi semula agar aman
                        hrp.CFrame = originalCF
                    end)
                end
            end
        end
    end
end)

-- 2. NENEK ESP (HOLOGRAM GREEN)
RunService.Heartbeat:Connect(function()
    if _G.GrandmaESP then
        local grandma = getGrandma()
        if grandma and grandma:FindFirstChildOfClass("Humanoid") then
            if not grandmaHighlights[grandma] then
                local hl = Instance.new("Highlight")
                hl.Name = "GrandmaHoloESP"
                hl.FillColor = Color3.fromRGB(0, 255, 0) -- Hijau Full
                hl.OutlineColor = Color3.fromRGB(0, 255, 0)
                hl.FillTransparency = 0.4
                hl.OutlineTransparency = 0
                hl.DepthMode = Enum.HighlightDepthMode.AlwaysOnTop
                hl.Adornee = grandma
                hl.Parent = grandma
                grandmaHighlights[grandma] = hl
            end
        end
    else
        -- Hapus Highlight jika dimatikan
        for gm, hl in pairs(grandmaHighlights) do
            if hl then hl:Destroy() end
            grandmaHighlights[gm] = nil
        end
    end
end)

-- 3. COOKIES ESP (TEXT DRAWING)
RunService.RenderStepped:Connect(function()
    if _G.CookieESP and LocalPlayer.Character and LocalPlayer.Character:FindFirstChild("HumanoidRootPart") then
        local myPos = LocalPlayer.Character.HumanoidRootPart.Position
        local cookies = findCookies()
        
        -- Hapus text lama yang sudah tidak valid
        for cookie, text in pairs(cookieDrawings) do
            if not cookie or not cookie.Parent then
                text.Visible = false
                text:Remove()
                cookieDrawings[cookie] = nil
            end
        end
        
        -- Buat atau perbarui posisi teks ESP kue
        for _, cookie in pairs(cookies) do
            local part = cookie:IsA("Model") and (cookie:FindFirstChild("Handle") or cookie:FindFirstChildOfClass("BasePart")) or cookie
            if part and part:IsA("BasePart") then
                local vector, onScreen = Camera:WorldToViewportPoint(part.Position)
                
                if onScreen then
                    local distance = (myPos - part.Position).Magnitude
                    if not cookieDrawings[cookie] then
                        local text = Drawing.new("Text")
                        text.Size = 14
                        text.Color = Color3.fromRGB(255, 200, 0) -- Warna Oranye/Kuning Kue
                        text.Center = true
                        text.Outline = true
                        cookieDrawings[cookie] = text
                    end
                    
                    local draw = cookieDrawings[cookie]
                    draw.Position = Vector2.new(vector.X, vector.Y)
                    draw.Text = "🍪 Kue [" .. math.floor(distance) .. "m]"
                    draw.Visible = true
                else
                    if cookieDrawings[cookie] then cookieDrawings[cookie].Visible = false end
                end
            end
        end
    else
        -- Sembunyikan semua teks jika fitur dimatikan
        for _, text in pairs(cookieDrawings) do
            text.Visible = false
        end
    end
end)

-- 4. CHARACTER MODIFICATIONS (SPEED, JUMP, NOCLIP, STAMINA)
RunService.Heartbeat:Connect(function()
    local char = LocalPlayer.Character
    local hum = char and char:FindFirstChildOfClass("Humanoid")
    
    if hum then
        if _G.WalkSpeedEnabled then hum.WalkSpeed = customSpeed end
        if _G.JumpPowerEnabled then 
            hum.UseJumpPower = true
            hum.JumpPower = customJump 
        end
    end
    
    if _G.NoClipEnabled and char then
        for _, part in pairs(char:GetDescendants()) do
            if part:IsA("BasePart") then part.CanCollide = false end
        end
    end
    
    -- Bypass Stamina jika game menyimpannya di dalam script lokal karakter
    if _G.InfiniteStamina and char then
        local stamina = char:FindFirstChild("Stamina") or LocalPlayer:FindFirstChild("Stamina") or char:FindFirstChild("Energy")
        if stamina and stamina:IsA("NumberValue") or stamina:IsA("IntValue") then
            stamina.Value = 100
        end
    end
end)


-- ================== UI TABS & ELEMENTS ==================

-- TAB UTAMA (MAIN/AUTOMATION)
local TabMain = Window:CreateTab("Main", "zap")

TabMain:CreateToggle({
    Name = "Instant Auto Collect & Eat 🍪",
    CurrentValue = false,
    Flag = "AutoCollectEatFlag",
    Callback = function(state)
        _G.AutoCollectEat = state
        Rayfield:Notify({
            Title = "Auto Collect",
            Content = state and "Instant Auto Collect + Eat AKTIF!" or "Auto Collect Dinonaktifkan.",
            Duration = 2,
            Image = 4483362458
        })
    end,
})

TabMain:CreateDivider()

TabMain:CreateToggle({
    Name = "Infinite Stamina / Energy ⚡",
    CurrentValue = false,
    Flag = "InfStaminaFlag",
    Callback = function(state)
        _G.InfiniteStamina = state
    end,
})

-- TAB VISUAL (ESP SYSTEM)
local TabESP = Window:CreateTab("Visual ESP", "eye")

TabESP:CreateToggle({
    Name = "Grandma Hologram ESP 🟢",
    CurrentValue = false,
    Flag = "GrandmaESPFlag",
    Callback = function(state)
        _G.GrandmaESP = state
    end,
})

TabESP:CreateToggle({
    Name = "Cookies ESP 🍪",
    CurrentValue = false,
    Flag = "CookieESPFlag",
    Callback = function(state)
        _G.CookieESP = state
    end,
})

-- TAB LOCAL PLAYER (PERGERAKAN)
local TabPlayer = Window:CreateTab("Player Hack", "user")

TabPlayer:CreateToggle({
    Name = "Enable Speed Hack",
    CurrentValue = false,
    Flag = "SpeedToggle",
    Callback = function(state)
        _G.WalkSpeedEnabled = state
        if not state then
            local hum = LocalPlayer.Character and LocalPlayer.Character:FindFirstChildOfClass("Humanoid")
            if hum then hum.WalkSpeed = 16 end -- Kembalikan ke normal
        end
    end,
})

TabPlayer:CreateSlider({
    Name = "Walk Speed Value",
    Range = {16, 250},
    Increment = 1,
    CurrentValue = customSpeed,
    Flag = "SpeedSlider",
    Callback = function(val)
        customSpeed = val
    end,
})

TabPlayer:CreateDivider()

TabPlayer:CreateToggle({
    Name = "Enable Jump Hack",
    CurrentValue = false,
    Flag = "JumpToggle",
    Callback = function(state)
        _G.JumpPowerEnabled = state
        if not state then
            local hum = LocalPlayer.Character and LocalPlayer.Character:FindFirstChildOfClass("Humanoid")
            if hum then hum.JumpPower = 50 end -- Kembalikan ke normal
        end
    end,
})

TabPlayer:CreateSlider({
    Name = "Jump Power Value",
    Range = {50, 200},
    Increment = 1,
    CurrentValue = customJump,
    Flag = "JumpSlider",
    Callback = function(val)
        customJump = val
    end,
})

TabPlayer:CreateDivider()

TabPlayer:CreateToggle({
    Name = "NoClip (Tembus Tembok)",
    CurrentValue = false,
    Flag = "NoClipFlag",
    Callback = function(state)
        _G.NoClipEnabled = state
    end,
})

-- Notifikasi bahwa UI berhasil dimuat sepenuhnya
Rayfield:Notify({
    Title = "Drip Client Loaded",
    Content = "Script siap digunakan untuk mencuri seluruh kue!",
    Duration = 3,
    Image = 4483362458
})