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
    LoadingTitle = "Drip X Putzzdev",
    LoadingSubtitle = "Premium",
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
    PlayerESP = false,
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
local playerHighlights = {}
local cookieDrawings = {}

-- ================== UTILITY FUNCTIONS ==================

-- Fungsi mencari objek Kue / Cookies di Map
local function findCookies()
    local cookies = {}
    for _, obj in pairs(workspace:GetDescendants()) do
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

-- Fungsi menerapkan Hologram Hijau ke Player
local function applyHighlightToPlayer(player)
    if player == LocalPlayer then return end
    
    local function addHighlight(char)
        if not char then return end
        task.wait(0.3)
        if _G.PlayerESP and not playerHighlights[player] then
            local hl = Instance.new("Highlight")
            hl.Name = "PlayerHoloESP"
            hl.FillColor = Color3.fromRGB(0, 255, 0) -- Hijau Full
            hl.OutlineColor = Color3.fromRGB(0, 255, 0)
            hl.FillTransparency = 0.4
            hl.OutlineTransparency = 0
            hl.DepthMode = Enum.HighlightDepthMode.AlwaysOnTop
            hl.Adornee = char
            hl.Parent = char
            playerHighlights[player] = hl
        end
    end

    if player.Character then addHighlight(player.Character) end
    player.CharacterAdded:Connect(addHighlight)
end

-- Fungsi menghapus Hologram dari Player
local function removeHighlightFromPlayer(player)
    if playerHighlights[player] then
        pcall(function() playerHighlights[player]:Destroy() end)
        playerHighlights[player] = nil
    end
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
                
                local targetPart = cookie:IsA("Model") and (cookie:FindFirstChild("Handle") or cookie:FindFirstChildOfClass("BasePart")) or cookie
                
                if targetPart and targetPart:IsA("BasePart") then
                    local originalCF = hrp.CFrame
                    
                    pcall(function()
                        hrp.CFrame = targetPart.CFrame
                        task.wait(0.05)
                        
                        local prompt = cookie:FindFirstChildOfClass("ProximityPrompt") or cookie.Parent:FindFirstChildOfClass("ProximityPrompt")
                        if prompt then
                            fireproximityprompt(prompt)
                        end
                        
                        local backpack = LocalPlayer:FindFirstChild("Backpack")
                        local char = LocalPlayer.Character
                        
                        if backpack then
                            for _, tool in pairs(backpack:GetChildren()) do
                                if string.find(string.lower(tool.Name), "cookie") or string.find(string.lower(tool.Name), "kue") then
                                    tool.Parent = char
                                    task.wait(0.05)
                                    tool:Activate()
                                    task.wait(0.05)
                                    tool.Parent = backpack
                                end
                            end
                        end
                        
                        hrp.CFrame = originalCF
                    end)
                end
            end
        end
    end
end)

-- 2. PLAYER ESP CONTROLLER (MONITOR TOGGLE STATE)
RunService.Heartbeat:Connect(function()
    if _G.PlayerESP then
        for _, player in pairs(Players:GetPlayers()) do
            if player ~= LocalPlayer and not playerHighlights[player] and player.Character then
                applyHighlightToPlayer(player)
            end
        end
    else
        for player, _ in pairs(playerHighlights) do
            removeHighlightFromPlayer(player)
        end
    end
end)

-- 3. COOKIES ESP (TEXT DRAWING)
RunService.RenderStepped:Connect(function()
    if _G.CookieESP and LocalPlayer.Character and LocalPlayer.Character:FindFirstChild("HumanoidRootPart") then
        local myPos = LocalPlayer.Character.HumanoidRootPart.Position
        local cookies = findCookies()
        
        for cookie, text in pairs(cookieDrawings) do
            if not cookie or not cookie.Parent then
                text.Visible = false
                text:Remove()
                cookieDrawings[cookie] = nil
            end
        end
        
        for _, cookie in pairs(cookies) do
            local part = cookie:IsA("Model") and (cookie:FindFirstChild("Handle") or cookie:FindFirstChildOfClass("BasePart")) or cookie
            if part and part:IsA("BasePart") then
                local vector, onScreen = Camera:WorldToViewportPoint(part.Position)
                
                if onScreen then
                    local distance = (myPos - part.Position).Magnitude
                    if not cookieDrawings[cookie] then
                        local text = Drawing.new("Text")
                        text.Size = 14
                        text.Color = Color3.fromRGB(255, 200, 0)
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
        for _, text in pairs(cookieDrawings) do
            text.Visible = false
        end
    end
end)

-- 4. CHARACTER MODIFICATIONS
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
    
    if _G.InfiniteStamina and char then
        local stamina = char:FindFirstChild("Stamina") or LocalPlayer:FindFirstChild("Stamina") or char:FindFirstChild("Energy")
        if stamina and (stamina:IsA("NumberValue") or stamina:IsA("IntValue")) then
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
    Name = "Player Hologram ESP 🟢",
    CurrentValue = false,
    Flag = "PlayerESPFlag",
    Callback = function(state)
        _G.PlayerESP = state
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
            if hum then hum.WalkSpeed = 16 end
        end
    end,
})

TabPlayer:CreateSlider({
    Name = "Walk Speed",
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
            if hum then hum.JumpPower = 50 end
        end
    end,
})

TabPlayer:CreateSlider({
    Name = "Jump Power",
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
    Name = "NoClip",
    CurrentValue = false,
    Flag = "NoClipFlag",
    Callback = function(state)
        _G.NoClipEnabled = state
    end,
})

-- Player Join/Leave Connections untuk ESP
Players.PlayerAdded:Connect(function(player)
    if _G.PlayerESP then
        applyHighlightToPlayer(player)
    end
end)

Players.PlayerRemoving:Connect(function(player)
    removeHighlightFromPlayer(player)
end)

-- Notifikasi Selesai
Rayfield:Notify({
    Title = "Drip Client Updated",
    Content = "ESP Player Hijau Hologram siap digunakan!",
    Duration = 3,
    Image = 4483362458
})