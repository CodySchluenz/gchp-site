<?php

               //tests for valid login    needs to be on every page
if (!isset($_SESSION))
{
session_start(); 
}
if (!$_SESSION["valid_user"])
{
	// User not logged in, redirect to login page
	header("Location: ../login.php");

}


include "../../includes/databasesetup.php";
// click the update button/LINK
if (isset($_GET['edit']))
{

	


	include 'update.html.php';
	exit();

}



if (isset($_POST['Update']))

	try 
	
		{

	//1//	
		$sql = 'UPDATE pickup SET ParaText = :ParaText
		WHERE ParaNum = 1';
	
		$s = $pdo->prepare($sql);
		$s->bindValue(':ParaText', $_POST['txtHeader']);
		$s->execute();
		
	//2//
		$sql = 'UPDATE pickup SET ParaText = :ParaText
		WHERE ParaNum = 2';
	
		$s = $pdo->prepare($sql);
		$s->bindValue(':ParaText', $_POST['txtParagraph']);
		$s->execute();
		

	//3//
		$sql = 'UPDATE pickup SET ParaText = :ParaText
		WHERE ParaNum = 3';

		$s = $pdo->prepare($sql);
		$s->bindValue(':ParaText', $_POST['txtdate1']);
		$s->execute();
		

	//4//			
		$sql = 'UPDATE pickup SET ParaText = :ParaText
		WHERE ParaNum = 4';

		$s = $pdo->prepare($sql);
		$s->bindValue(':ParaText', $_POST['txtdescription1']);
		$s->execute();
		

	//5//
		$sql = 'UPDATE pickup SET ParaText = :ParaText
		WHERE ParaNum = 5';

		$s = $pdo->prepare($sql);
		$s->bindValue(':ParaText', $_POST['txtdate2']);
		$s->execute();
	
	

	//6//	
		$sql = 'UPDATE pickup SET ParaText = :ParaText
		WHERE ParaNum = 6';

		$s = $pdo->prepare($sql);
		$s->bindValue(':ParaText', $_POST['txtdescription2']);
		$s->execute();
	

	//7//	
		$sql = 'UPDATE pickup SET ParaText = :ParaText
		WHERE ParaNum = 7';

		$s = $pdo->prepare($sql);
		$s->bindValue(':ParaText', $_POST['txtdate3']);
		$s->execute();
	

	//8//	
		$sql = 'UPDATE pickup SET ParaText = :ParaText
		WHERE ParaNum = 8';

		$s = $pdo->prepare($sql);
		$s->bindValue(':ParaText', $_POST['txtdescription3']);
		$s->execute();
	

	//9//
		$sql = 'UPDATE pickup SET ParaText = :ParaText
		WHERE ParaNum = 9';

		$s = $pdo->prepare($sql);
		$s->bindValue(':ParaText', $_POST['txtdate4']);
		$s->execute();
	

	
	//10///	
		$sql = 'UPDATE pickup SET ParaText = :ParaText
		WHERE ParaNum = 10';

		$s = $pdo->prepare($sql);
		$s->bindValue(':ParaText', $_POST['txtdescription4']);
		$s->execute();
	

	
	//11//	
		$sql = 'UPDATE pickup SET ParaText = :ParaText
		WHERE ParaNum = 11';

		$s = $pdo->prepare($sql);
		$s->bindValue(':ParaText', $_POST['txtdate5']);
		$s->execute();
	
	
	//12//	
		$sql = 'UPDATE pickup SET ParaText = :ParaText
		WHERE ParaNum = 12';

		$s = $pdo->prepare($sql);
		$s->bindValue(':ParaText', $_POST['txtdescription5']);
		$s->execute();
		
		
	
	//13//	
		$sql = 'UPDATE pickup SET ParaText = :ParaText
		WHERE ParaNum = 13';

		$s = $pdo->prepare($sql);
		$s->bindValue(':ParaText', $_POST['txtdate6']);
		$s->execute();
		

	//14//	
		$sql = 'UPDATE pickup SET ParaText = :ParaText
		WHERE ParaNum = 14';

		$s = $pdo->prepare($sql);
		$s->bindValue(':ParaText', $_POST['txtdescription6']);
		$s->execute();
		

		
				
	//15//	
		$sql = 'UPDATE pickup SET ParaText = :ParaText
		WHERE ParaNum = 15';

		$s = $pdo->prepare($sql);
		$s->bindValue(':ParaText', $_POST['txtdate7']);
		$s->execute();
	
	

	//16//	
		$sql = 'UPDATE pickup SET ParaText = :ParaText
		WHERE ParaNum = 16';

		$s = $pdo->prepare($sql);
		$s->bindValue(':ParaText', $_POST['txtdescription7']);
		$s->execute();
		
		
	
	//17//
		$sql = 'UPDATE pickup SET ParaText = :ParaText
		WHERE ParaNum = 17';

		$s = $pdo->prepare($sql);
		$s->bindValue(':ParaText', $_POST['txtdate8']);
		$s->execute();
		
		
	
	//18//
		$sql = 'UPDATE pickup SET ParaText = :ParaText
		WHERE ParaNum = 18';

		$s = $pdo->prepare($sql);
		$s->bindValue(':ParaText', $_POST['txtdescription8']);
		$s->execute();
		
		
	
	//19//
		$sql = 'UPDATE pickup SET ParaText = :ParaText
		WHERE ParaNum = 19';

		$s = $pdo->prepare($sql);
		$s->bindValue(':ParaText', $_POST['txtdate9']);
		$s->execute();
	
	//20//
		$sql = 'UPDATE pickup SET ParaText = :ParaText
		WHERE ParaNum = 20';

		$s = $pdo->prepare($sql);
		$s->bindValue(':ParaText', $_POST['txtdescription9']);
		$s->execute();
	
	
	
	//21//
		$sql = 'UPDATE pickup SET ParaText = :ParaText
		WHERE ParaNum = 21';

		$s = $pdo->prepare($sql);
		$s->bindValue(':ParaText', $_POST['txtdate10']);
		$s->execute();
		
		
		
	//22//
		$sql = 'UPDATE pickup SET ParaText = :ParaText
		WHERE ParaNum = 22';

		$s = $pdo->prepare($sql);
		$s->bindValue(':ParaText', $_POST['txtdescription10']);
		$s->execute();
	
	
	
	//23//
		$sql = 'UPDATE pickup SET ParaText = :ParaText
		WHERE ParaNum = 23';

		$s = $pdo->prepare($sql);
		$s->bindValue(':ParaText', $_POST['txtPickup']);
		$s->execute();
	

	}
		
	catch (PDOException $e)
		
		{
		  $error = 'Error fetching data: ' . $e->getMessage();
		  echo $error;
		  exit();
		}

////////////------------------    end of updates    ------------------////////////



	try
	{
	  $sql = 'SELECT * FROM pickup';
	  $result = $pdo->query($sql);
	}
		catch (PDOException $e)
		{
		  $error = ' OOPS!! Error fetching data: ' . $e->getMessage();
		  include "../../includes/error.html.php";
		  exit();
		}

					
	while ($row = $result->fetch())
		{
		$pickups[] = array ('ParaNum'=>$row['ParaNum'],
		
			'ParaNum'=>$row['ParaNum'],
			'ParaText'=>$row['ParaText']);
	}
	
	include 'pickup.html.php';
	
?>