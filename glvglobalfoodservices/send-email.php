<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$to      = 'info@glvglobalfoodservices.com';
$name    = strip_tags(trim($_POST['name']    ?? ''));
$company = strip_tags(trim($_POST['company'] ?? ''));
$email   = filter_var(trim($_POST['email']   ?? ''), FILTER_SANITIZE_EMAIL);
$phone   = strip_tags(trim($_POST['phone']   ?? ''));
$product = strip_tags(trim($_POST['product'] ?? ''));
$dest    = strip_tags(trim($_POST['destination'] ?? ''));
$volume  = strip_tags(trim($_POST['volume']  ?? ''));
$incoterm= strip_tags(trim($_POST['incoterm']?? ''));
$payment = strip_tags(trim($_POST['payment'] ?? ''));
$message = strip_tags(trim($_POST['message'] ?? ''));

if (!$name || !$email || !$product) {
    echo json_encode(['success' => false, 'error' => 'Missing required fields']);
    exit;
}

$subject = "GLV Food Services — Cotización: {$product} | {$company}";

$body  = "===========================================\n";
$body .= " GLV GLOBAL FOOD SERVICES LLC — MIAMI\n";
$body .= " Nueva Solicitud de Cotización\n";
$body .= "===========================================\n\n";
$body .= "CONTACTO\n";
$body .= "--------\n";
$body .= "Nombre:    {$name}\n";
$body .= "Empresa:   {$company}\n";
$body .= "Email:     {$email}\n";
$body .= "WhatsApp:  {$phone}\n\n";
$body .= "PEDIDO\n";
$body .= "------\n";
$body .= "Producto:  {$product}\n";
$body .= "Destino:   {$dest}\n";
$body .= "Volumen:   {$volume}\n";
$body .= "Incoterm:  {$incoterm}\n";
$body .= "Pago:      {$payment}\n\n";
if ($message) {
    $body .= "MENSAJE ADICIONAL\n";
    $body .= "-----------------\n";
    $body .= "{$message}\n\n";
}
$body .= "-------------------------------------------\n";
$body .= "Enviado desde glvglobalfoodservices.com\n";
$body .= date('Y-m-d H:i:s T') . "\n";

$headers  = "From: GLV Food Services <noreply@glvglobalfoodservices.com>\r\n";
$headers .= "Reply-To: {$name} <{$email}>\r\n";
$headers .= "X-Mailer: GLV-QuoteForm/1.0\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

$sent = mail($to, $subject, $body, $headers);

if ($sent) {
    // Auto-reply to client
    $replySubject = "GLV Global Food Services — Recibimos su solicitud / We received your request";
    $replyBody  = "Dear {$name},\n\n";
    $replyBody .= "Thank you for contacting GLV Global Food Services LLC — Miami, Florida.\n";
    $replyBody .= "We have received your inquiry for: {$product}\n\n";
    $replyBody .= "Our team will respond within 24 business hours.\n\n";
    $replyBody .= "---\n\n";
    $replyBody .= "Estimado/a {$name},\n\n";
    $replyBody .= "Gracias por contactar a GLV Global Food Services LLC — Miami, Florida.\n";
    $replyBody .= "Hemos recibido su solicitud para: {$product}\n\n";
    $replyBody .= "Nuestro equipo responderá en menos de 24 horas hábiles.\n\n";
    $replyBody .= "WhatsApp 🇨🇴 +57 316 086 5294\n";
    $replyBody .= "WhatsApp 🇧🇷 +55 11 9466 10038\n";
    $replyBody .= "Email: info@glvglobalfoodservices.com\n\n";
    $replyBody .= "Where Food Moves Markets.\n";
    $replyBody .= "GLV Global Food Services LLC\n";

    $replyHeaders  = "From: GLV Global Food Services <info@glvglobalfoodservices.com>\r\n";
    $replyHeaders .= "MIME-Version: 1.0\r\n";
    $replyHeaders .= "Content-Type: text/plain; charset=UTF-8\r\n";
    mail($email, $replySubject, $replyBody, $replyHeaders);

    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false, 'error' => 'Mail server error']);
}
