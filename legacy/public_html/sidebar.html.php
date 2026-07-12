 <?php
  

include "includes/databasesetup.php";?>
<br><br><br><h3>Latest News</h3>

try
{
	$sql = 'SELECT * from bar';
	$result = $pdo->query($sql);
	while ($row = $result->fetch())
	{
	 $bars[] = array ('sbID'=>$row['sbID'],
	 
		'title'=>$row['title'],
		'subtitle'=>$row['subtitle'],
		'para'=>$row['para'] );
				

	
}
catch (PDOException $e)
{
	  $error = 'Error fetching DATA!!! ' . $e->getMessage();
	  include 'OOPS!!!Error.html.php';
	  exit();
}

<div id="sidebar">
<table width="200px">


<?php
	foreach ($bars as $bar): 

<tr>
	<div class="title"><tr><h3><?php echo $bar['title']?></h3></tr></div>
	<br>
	<div class="subtitle"><tr><h4><?php echo $bar['subtitle']?></h4></tr></div>
	<br>
	<div class="para"><tr><p><?php echo $bar['para'] ?></p></tr></div>
	<br>
</tr> 

<?php endforeach;?>
        <h4>Useful Links</h4>
<a href="pickUp.php" target="_blank">Pickup Schedule</a>
        <a href="PDFapplication.pdf" target="_blank">PDF Application</a>
       <a href="http://grantcounty.org/" target="_blank">Grant County Website</a><br>
<img src="imgs/tft.gif" alt="Toys For Tots" /><br>Toys donated by Toys for Tots <br>Dubuque, IA.<br>
    	
</div>
</table>