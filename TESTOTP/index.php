<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OTP Verification</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container">
        <h2>Verify Your Phone Number</h2>
        <form action="" id="otpForm">
            <div class="form-group">
                <label for="phone">Mobile Number</label>
                <input type="tel" name="phone" id="phone" placeholder="Enter 10-digit number" maxlength="10" required>
            </div>
            <button type="submit" id="submitBtn">Send OTP</button>
        </form>
        <div id="message" class="message"></div>
    </div>

    <script src="script.js"></script>
</body>
</html>