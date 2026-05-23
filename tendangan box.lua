-- ================== DRIP LUCKY BLOCK SCRIPT ==================
-- Game: Kick a Lucky Block
-- Executor: Delta (HP)
-- Fitur: Full Autofarm, Auto Kick, Auto Rebirth, Auto Collect, Auto Place, Auto Sell, Tsunami Runner
-- Developer: Putzzdev

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local VirtualInput = game:GetService("VirtualInput")
local LocalPlayer = Players.LocalPlayer
local Camera = workspace.CurrentCamera

-- ================== KONFIGURASI ==================
local config = {
    autoKick = true,
    autoPerfectKick = true,
    autoTrain = true,
    autoRebirth = true,
    autoCollect = true,
    autoPlace = true,
    autoSell = true,
    autoRunFromTsunami = true,
    kickInterval = 0.5,
    targetRarity = "Mythic" -- Common, Rare, Epic, Legendary, Mythic, Celestial
}

-- ================== VARIABEL ==================
local kickButton = nil
local trainButton = nil
local rebirthButton = nil
local sellButton = nil
local isRunning = false
local currentZone = "Safe"

-- ================== FUNGSI UTILITY ==================
local function findButton(buttonName)
    for _, v in pairs(game:GetService("CoreGui"):GetDescendants()) do
        if v:IsA("TextButton") and v.Name:lower():find(buttonName:lower()) then
            return v
        end
    end
    for _, v in pairs(game:GetService("Players").LocalPlayer.PlayerGui:GetDescendants()) do
        if v:IsA("TextButton") and v.Name:lower():find(buttonName:lower()) then
            return v
        end
    end
    for _, v in pairs(game:GetService("StarterGui"):GetDescendants()) do
        if v:IsA("TextButton") and v.Name:lower():find(buttonName:lower()) then
            return v
        end
    end
    return nil
end

local function findPart(partName)
    for _, v in pairs(workspace:GetDescendants()) do
        if v.Name:lower():find(partName:lower()) and v:IsA("BasePart") then
            return v
        end
    end
    return nil
end

-- ================== AUTO KICK & PERFECT KICK ==================
local function performKick()
    if not config.autoKick then return end
    
    local kickBtn = findButton("Kick") or findButton("kick")
    if kickBtn and kickBtn:IsA("TextButton") then
        kickBtn:Click()
        task.wait(0.1)
        
        -- Perfect Kick: isi meter sampai full
        if config.autoPerfectKick then
            local meter = findPart("Meter") or findPart("PowerMeter")
            if meter then
                -- Simulasi hold untuk perfect kick
                local kickPart = findPart("KickZone") or findPart("Ball")
                if kickPart then
                    VirtualInput:SendMouseButtonEvent(kickPart.AbsolutePosition.X, kickPart.AbsolutePosition.Y, 0, true)
                    task.wait(0.5)
                    VirtualInput:SendMouseButtonEvent(kickPart.AbsolutePosition.X, kickPart.AbsolutePosition.Y, 0, false)
                end
            end
        end
    end
end

-- ================== AUTO TRAIN (Weight/Barbel) ==================
local function performTrain()
    if not config.autoTrain then return end
    
    local trainBtn = findButton("Train") or findButton("Weight") or findButton("Barbel")
    if trainBtn and trainBtn:IsA("TextButton") then
        trainBtn:Click()
        task.wait(0.5)
    end
end

-- ================== AUTO REBIRTH ==================
local function performRebirth()
    if not config.autoRebirth then return end
    
    local rebirthBtn = findButton("Rebirth") or findButton("Reborn")
    if rebirthBtn and rebirthBtn:IsA("TextButton") and rebirthBtn.Visible then
        rebirthBtn:Click()
        task.wait(1)
    end
end

-- ================== AUTO COLLECT BRAINROT ==================
local function collectBrainrot()
    if not config.autoCollect then return end
    
    for _, item in pairs(workspace:GetDescendants()) do
        if item:IsA("BasePart") and (item.Name:lower():find("brain") or item.Name:lower():find("rot") or item.Name:lower():find("brainrot")) then
            local humanoidRootPart = LocalPlayer.Character and LocalPlayer.Character:FindFirstChild("HumanoidRootPart")
            if humanoidRootPart then
                local distance = (humanoidRootPart.Position - item.Position).Magnitude
                if distance <= 15 then
                    firetouchinterest(humanoidRootPart, item, 0)
                    task.wait(0.05)
                    firetouchinterest(humanoidRootPart, item, 1)
                end
            end
        end
    end
end

-- ================== AUTO PLACE BRAINROT ==================
local function placeBrainrot()
    if not config.autoPlace then return end
    
    local pedestal = findPart("Pedestal") or findPart("Base")
    if pedestal then
        local humanoidRootPart = LocalPlayer.Character and LocalPlayer.Character:FindFirstChild("HumanoidRootPart")
        if humanoidRootPart then
            firetouchinterest(humanoidRootPart, pedestal, 0)
            task.wait(0.1)
            firetouchinterest(humanoidRootPart, pedestal, 1)
        end
    end
end

-- ================== AUTO SELL ==================
local function performSell()
    if not config.autoSell then return end
    
    local sellBtn = findButton("Sell") or findButton("Sell All")
    if sellBtn and sellBtn:IsA("TextButton") then
        sellBtn:Click()
        task.wait(0.3)
    end
end

-- ================== TSUNAMI RUNNER ==================
local function runToBase()
    if not config.autoRunFromTsunami then return end
    
    local tsunami = findPart("Tsunami") or findPart("Wave")
    if tsunami then
        local base = findPart("Base") or findPart("Spawn") or findPart("Home")
        if base then
            local humanoidRootPart = LocalPlayer.Character and LocalPlayer.Character:FindFirstChild("HumanoidRootPart")
            if humanoidRootPart then
                local distanceToTsunami = (humanoidRootPart.Position - tsunami.Position).Magnitude
                if distanceToTsunami < 50 then
                    humanoidRootPart.CFrame = base.CFrame + Vector3.new(0, 3, 0)
                end
            end
        end
    end
end

-- ================== DETEKSI ZONA ==================
local function detectZone()
    local humanoidRootPart = LocalPlayer.Character and LocalPlayer.Character:FindFirstChild("HumanoidRootPart")
    if not humanoidRootPart then return end
    
    local pos = humanoidRootPart.Position
    local distanceFromCenter = math.sqrt(pos.X^2 + pos.Z^2)
    
    if distanceFromCenter < 50 then
        currentZone = "Common"
    elseif distanceFromCenter < 100 then
        currentZone = "Rare"
    elseif distanceFromCenter < 150 then
        currentZone = "Epic"
    elseif distanceFromCenter < 200 then
        currentZone = "Legendary"
    elseif distanceFromCenter < 300 then
        currentZone = "Mythic"
    else
        currentZone = "Celestial"
    end
    
    return currentZone
end

-- ================== GUI (Toggle On/Off) ==================
local function createGUI()
    local screenGui = Instance.new("ScreenGui")
    screenGui.Name = "DripLuckyBlock"
    screenGui.Parent = game.CoreGui
    screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
    screenGui.DisplayOrder = 999
    
    local mainFrame = Instance.new("Frame")
    mainFrame.Parent = screenGui
    mainFrame.Size = UDim2.new(0, 200, 0, 350)
    mainFrame.Position = UDim2.new(0, 10, 0.5, -175)
    mainFrame.BackgroundColor3 = Color3.fromRGB(20, 20, 30)
    mainFrame.BackgroundTransparency = 0.1
    mainFrame.BorderSizePixel = 2
    mainFrame.BorderColor3 = Color3.fromRGB(0, 255, 255)
    mainFrame.Active = true
    mainFrame.Draggable = true
    
    local mainCorner = Instance.new("UICorner")
    mainCorner.Parent = mainFrame
    mainCorner.CornerRadius = UDim.new(0, 12)
    
    local title = Instance.new("TextLabel")
    title.Parent = mainFrame
    title.Size = UDim2.new(1, 0, 0, 35)
    title.Position = UDim2.new(0, 0, 0, 0)
    title.BackgroundColor3 = Color3.fromRGB(0, 255, 255)
    title.BackgroundTransparency = 0.2
    title.Text = "⚔️ DRIP LUCKY ⚔️"
    title.TextColor3 = Color3.fromRGB(255, 255, 255)
    title.Font = Enum.Font.GothamBlack
    title.TextSize = 14
    local titleCorner = Instance.new("UICorner")
    titleCorner.Parent = title
    titleCorner.CornerRadius = UDim.new(0, 12)
    
    local closeBtn = Instance.new("TextButton")
    closeBtn.Parent = mainFrame
    closeBtn.Size = UDim2.new(0, 25, 0, 25)
    closeBtn.Position = UDim2.new(1, -30, 0, 5)
    closeBtn.BackgroundColor3 = Color3.fromRGB(255, 50, 50)
    closeBtn.Text = "X"
    closeBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
    closeBtn.Font = Enum.Font.GothamBold
    closeBtn.TextSize = 14
    local closeCorner = Instance.new("UICorner")
    closeCorner.Parent = closeBtn
    closeCorner.CornerRadius = UDim.new(0, 6)
    closeBtn.MouseButton1Click:Connect(function()
        screenGui:Destroy()
    end)
    
    local layout = Instance.new("UIListLayout")
    layout.Parent = mainFrame
    layout.Padding = UDim.new(0, 8)
    layout.SortOrder = Enum.SortOrder.LayoutOrder
    layout.HorizontalAlignment = Enum.HorizontalAlignment.Center
    
    local function createToggle(text, configKey, default)
        local frame = Instance.new("Frame")
        frame.Parent = mainFrame
        frame.Size = UDim2.new(0.9, 0, 0, 35)
        frame.BackgroundColor3 = Color3.fromRGB(35, 35, 45)
        frame.BackgroundTransparency = 0.2
        frame.BorderSizePixel = 0
        local frameCorner = Instance.new("UICorner")
        frameCorner.Parent = frame
        frameCorner.CornerRadius = UDim.new(0, 8)
        
        local label = Instance.new("TextLabel")
        label.Parent = frame
        label.Size = UDim2.new(0.7, 0, 1, 0)
        label.Position = UDim2.new(0.05, 0, 0, 0)
        label.BackgroundTransparency = 1
        label.Text = text
        label.TextColor3 = Color3.fromRGB(255, 255, 255)
        label.Font = Enum.Font.Gotham
        label.TextSize = 12
        label.TextXAlignment = Enum.TextXAlignment.Left
        
        local switch = Instance.new("Frame")
        switch.Parent = frame
        switch.Size = UDim2.new(0, 45, 0, 22)
        switch.Position = UDim2.new(0.75, 0, 0.5, -11)
        switch.BackgroundColor3 = default and Color3.fromRGB(0, 255, 255) or Color3.fromRGB(60, 60, 70)
        switch.BorderSizePixel = 0
        local switchCorner = Instance.new("UICorner")
        switchCorner.Parent = switch
        switchCorner.CornerRadius = UDim.new(0, 11)
        
        local indicator = Instance.new("Frame")
        indicator.Parent = switch
        indicator.Size = UDim2.new(0, 18, 0, 18)
        indicator.Position = default and UDim2.new(1, -20, 0.5, -9) or UDim2.new(0.05, 0, 0.5, -9)
        indicator.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
        indicator.BorderSizePixel = 0
        local indicatorCorner = Instance.new("UICorner")
        indicatorCorner.Parent = indicator
        indicatorCorner.CornerRadius = UDim.new(1, 0)
        
        local state = default
        local btn = Instance.new("TextButton")
        btn.Parent = frame
        btn.Size = UDim2.new(1, 0, 1, 0)
        btn.BackgroundTransparency = 1
        btn.Text = ""
        btn.MouseButton1Click:Connect(function()
            state = not state
            config[configKey] = state
            TweenService:Create(switch, TweenInfo.new(0.15), {BackgroundColor3 = state and Color3.fromRGB(0, 255, 255) or Color3.fromRGB(60, 60, 70)}):Play()
            TweenService:Create(indicator, TweenInfo.new(0.15), {Position = state and UDim2.new(1, -20, 0.5, -9) or UDim2.new(0.05, 0, 0.5, -9)}):Play()
        end)
    end
    
    createToggle("⚡ Auto Kick", "autoKick", true)
    createToggle("🎯 Perfect Kick", "autoPerfectKick", true)
    createToggle("💪 Auto Train", "autoTrain", true)
    createToggle("🔄 Auto Rebirth", "autoRebirth", true)
    createToggle("📦 Auto Collect", "autoCollect", true)
    createToggle("📍 Auto Place", "autoPlace", true)
    createToggle("💰 Auto Sell", "autoSell", true)
    createToggle("🌊 Tsunami Runner", "autoRunFromTsunami", true)
    
    local statusFrame = Instance.new("Frame")
    statusFrame.Parent = mainFrame
    statusFrame.Size = UDim2.new(0.9, 0, 0, 40)
    statusFrame.BackgroundColor3 = Color3.fromRGB(35, 35, 45)
    statusFrame.BackgroundTransparency = 0.2
    statusFrame.BorderSizePixel = 0
    local statusCorner = Instance.new("UICorner")
    statusCorner.Parent = statusFrame
    statusCorner.CornerRadius = UDim.new(0, 8)
    
    local zoneLabel = Instance.new("TextLabel")
    zoneLabel.Parent = statusFrame
    zoneLabel.Size = UDim2.new(1, 0, 0.5, 0)
    zoneLabel.Position = UDim2.new(0, 0, 0, 5)
    zoneLabel.BackgroundTransparency = 1
    zoneLabel.Text = "📍 Zona: -"
    zoneLabel.TextColor3 = Color3.fromRGB(0, 255, 255)
    zoneLabel.Font = Enum.Font.GothamBold
    zoneLabel.TextSize = 11
    
    local statusLabel = Instance.new("TextLabel")
    statusLabel.Parent = statusFrame
    statusLabel.Size = UDim2.new(1, 0, 0.5, 0)
    statusLabel.Position = UDim2.new(0, 0, 0, 22)
    statusLabel.BackgroundTransparency = 1
    statusLabel.Text = "✅ Script Active"
    statusLabel.TextColor3 = Color3.fromRGB(100, 255, 100)
    statusLabel.Font = Enum.Font.Gotham
    statusLabel.TextSize = 10
    
    -- Update status setiap detik
    task.spawn(function()
        while screenGui and screenGui.Parent do
            pcall(function()
                zoneLabel.Text = "📍 Zona: " .. detectZone()
            end)
            task.wait(1)
        end
    end)
end

-- ================== MAIN LOOP ==================
local function startAutoFarm()
    if isRunning then return end
    isRunning = true
    
    createGUI()
    
    print("🚀 DRIP LUCKY BLOCK SCRIPT ACTIVATED!")
    print("✅ Auto Farm started - by Putzzdev")
    
    while isRunning and config.autoKick do
        pcall(function()
            performKick()
            performTrain()
            performRebirth()
            collectBrainrot()
            placeBrainrot()
            performSell()
            runToBase()
        end)
        task.wait(config.kickInterval)
    end
end

-- ================== STOP FUNCTION ==================
local function stopAutoFarm()
    isRunning = false
    print("🛑 Auto Farm stopped")
end

-- ================== SCRIPT START ==================
startAutoFarm()

-- Auto restart jika character mati (respawn)
LocalPlayer.CharacterAdded:Connect(function()
    task.wait(2)
    if isRunning then
        print("🔄 Respawn detected, resuming auto farm...")
    end
end)

-- Handle executor close
game:GetService("CoreGui").ChildRemoved:Connect(function(child)
    if child.Name == "DripLuckyBlock" then
        isRunning = false
    end
end)

print("🎮 Script loaded! Pastikan lo di dalam game Kick a Lucky Block")