<?php
try
{
  $pdo = new PDO('mysql:host=localhost;dbname=grantco3_holidayProject', 'REDACTED_USER', 'REDACTED_PASSWORD');
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $pdo->exec('SET NAMES "utf8"');
}
catch (PDOException $e)
{
  $error = 'Unable to connect to the database server. set';
  include 'error.php';
  exit();
}
?>